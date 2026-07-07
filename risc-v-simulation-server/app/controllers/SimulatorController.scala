package controllers

import javax.inject._
import scala.collection.mutable
import scala.concurrent.ExecutionContext
import scala.jdk.CollectionConverters._
import scala.util.{Try, Using}

import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, LinkOption, Path, Paths}
import java.util.zip.{ZipEntry, ZipOutputStream}

import org.apache.pekko.actor.ActorSystem
import org.apache.pekko.stream.QueueOfferResult
import org.apache.pekko.stream.Materializer
import org.apache.pekko.stream.scaladsl._

import play.api.libs.json._
import play.api.mvc._

import models._

/** Single-session simulator controller.
  *
  * Ingest endpoints are called by the simulator process: POST /initial-state —
  * begin a new simulation POST /current-state — send full state snapshot (used
  * on reconnect) POST /state-update — incremental update POST /set-error —
  * error message to forward to the UI
  *
  * Polling endpoints are called by the simulator process: GET /get-next-action
  * — dequeue one pending action GET /get-key — get the latest keyboard input
  * GET /get-config — get the active config
  *
  * UI endpoints are called by the React frontend: POST /new-action — enqueue a
  * simulator action POST /new-key — send a keyboard character POST /set-config
  * — load a new config (triggers INITIALIZE action) GET /get-current-state —
  * full state snapshot for page load GET /get-available-configs — list default
  * configs from CONFIG_PATH GET /get-available-custom-configs — list custom
  * configs from CUSTOM_CONFIG_PATH POST /post-custom-config — persist a custom
  * config GET /socket — WebSocket for live updates
  */
@Singleton
class SimulatorController @Inject() (cc: ControllerComponents)(implicit
    system: ActorSystem,
    mat: Materializer,
    ec: ExecutionContext
) extends AbstractController(cc) {

  private val logger = play.api.Logger("SimulatorController")

  private val defaultConfigDirectory: Path = Paths
    .get(sys.env.getOrElse("CONFIG_PATH", "./configs"))
    .toAbsolutePath
    .normalize

  private val customConfigDirectory: Path = Paths
    .get(sys.env.getOrElse("CUSTOM_CONFIG_PATH", "./custom-configs"))
    .toAbsolutePath
    .normalize

  private val submissionDirectory: Path = Paths
    .get(sys.env.getOrElse("SUBMISSION_PATH", "./submissions"))
    .toAbsolutePath
    .normalize

  private val contributionsPath: Path = Paths
    .get(sys.env.getOrElse("CONTRIBUTIONS_PATH", "./contributions.md"))
    .toAbsolutePath
    .normalize

  private val validConfigIdRegex = "^[A-Za-z0-9._-]+$".r
  private val customConfigsLock = new AnyRef

  private val defaultConfigs: Vector[Config] =
    loadConfigsFromDirectory(defaultConfigDirectory)

  @volatile
  private var customConfigsById: Map[String, Config] =
    configsToUniqueMap(loadConfigsFromDirectory(customConfigDirectory))

  private val sourceFileRoot: Path = Paths
    .get(sys.env.getOrElse("SOURCE_FILE_ROOT", "./"))
    .toAbsolutePath
    .normalize

  private def loadConfigsFromDirectory(directory: Path): Vector[Config] = {
    if (!Files.exists(directory) || !Files.isDirectory(directory)) {
      logger.info(s"Config directory not found, skipping load: $directory")
      Vector.empty
    } else {
      val jsonFiles =
        Try {
          Using.resource(Files.list(directory)) { paths =>
            paths
              .iterator()
              .asScala
              .filter(path =>
                Files.isRegularFile(path) && path.getFileName.toString
                  .endsWith(".json")
              )
              .toVector
          }
        }.getOrElse(Vector.empty)

      jsonFiles.flatMap { file =>
        Try {
          val raw = Files.readString(file, StandardCharsets.UTF_8)
          Json.parse(raw).as[Config]
        }.toOption.orElse {
          logger.warn(s"Skipping invalid config file: $file")
          None
        }
      }
    }
  }

  private def configsToUniqueMap(configs: Seq[Config]): Map[String, Config] = {
    configs.foldLeft(Map.empty[String, Config]) { (acc, config) =>
      if (acc.contains(config.id)) {
        logger.warn(
          s"Duplicate custom config id on startup, skipping: ${config.id}"
        )
        acc
      } else {
        acc + (config.id -> config)
      }
    }
  }

  private def resolveSourcePath(rawPath: String): Either[Result, Path] = {
    val trimmed = rawPath.trim
    if (trimmed.isEmpty) {
      play.api
        .Logger("SimulatorController")
        .warn("resolveSourcePath: Missing path")
      Left(BadRequest("Missing path"))
    } else {
      val candidate = sourceFileRoot.resolve(trimmed).normalize
      play.api
        .Logger("SimulatorController")
        .debug(s"resolveSourcePath: Resolved candidate path: $candidate")
      if (!candidate.startsWith(sourceFileRoot)) {
        play.api
          .Logger("SimulatorController")
          .warn(s"resolveSourcePath: Invalid path attempt: $candidate")
        Left(BadRequest("Invalid path"))
      } else {
        play.api
          .Logger("SimulatorController")
          .info(s"resolveSourcePath: Path resolved successfully: $candidate")
        Right(candidate)
      }
    }
  }

  private def zipEntryName(path: Path): String =
    path.iterator().asScala.map(_.toString).mkString("/")

  private def addZipEntry(
      zip: ZipOutputStream,
      entryName: String,
      bytes: Array[Byte]
  ): Unit = {
    zip.putNextEntry(new ZipEntry(entryName))
    zip.write(bytes)
    zip.closeEntry()
  }

  // ---------------------------------------------------------------------------
  // Mutable state (single-session; replace with a session map for multi-tenant)
  // ---------------------------------------------------------------------------

  @volatile private var simulationState: Option[SimulationState] = None
  @volatile private var activeConfig: Option[Config] = None
  @volatile private var lastKey: (Int, Char) = (0, '\u0000')

  private val actionQueue = mutable.Queue.empty[UIAction]

  private val wsListeners =
    mutable.Set.empty[org.apache.pekko.stream.BoundedSourceQueue[String]]
  private val wsListenersLock = new AnyRef

  // ---------------------------------------------------------------------------
  // WebSocket
  // ---------------------------------------------------------------------------

  private def addWsListener(
      queue: org.apache.pekko.stream.BoundedSourceQueue[String]
  ): Unit =
    wsListenersLock.synchronized {
      wsListeners += queue
    }

  private def removeWsListener(
      queue: org.apache.pekko.stream.BoundedSourceQueue[String]
  ): Unit =
    wsListenersLock.synchronized {
      wsListeners -= queue
    }

  def socket: WebSocket = WebSocket.accept[String, String] { _ =>
    val (queue, source) = Source.queue[String](bufferSize = 64).preMaterialize()
    addWsListener(queue)

    // Coupling the sink/source lets us cleanup listeners when the client disconnects.
    val sink = Sink.onComplete[String] { _ =>
      removeWsListener(queue)
    }

    Flow.fromSinkAndSourceCoupled(sink, source)
  }

  private def broadcast(payload: JsValue): Unit = {
    val message = Json.stringify(payload)
    val staleListeners = wsListenersLock.synchronized {
      wsListeners.collect {
        case queue if (queue.offer(message) match {
              case QueueOfferResult.Enqueued    => false
              case QueueOfferResult.Dropped     => false
              case QueueOfferResult.QueueClosed => true
              case QueueOfferResult.Failure(_)  => true
            }) =>
          queue
      }.toVector
    }

    staleListeners.foreach(removeWsListener)
  }

  // ---------------------------------------------------------------------------
  // Ingest — called by the simulator process
  // ---------------------------------------------------------------------------

  def startSimulation: Action[JsValue] = Action(parse.json) { request =>
    val initial = request.body.as[InitialState]
    simulationState = Some(new SimulationState(initial))
    lastKey = (0, '\u0000')
    broadcast(Json.obj("type" -> "INITIAL-STATE", "state" -> initial))
    Ok("Simulation started")
  }

  def receiveCurrentState: Action[JsValue] = Action(parse.json) { request =>
    if (simulationState.isDefined) {
      Ok("State already exists")
    } else {
      val snap = request.body.as[StateSnapshot]
      val state = new SimulationState(snap.initialState)
      snap.updates.foreach(state.addReceivedUpdate)
      simulationState = Some(state)
      broadcast(Json.obj("type" -> "CURRENT-STATE", "state" -> snap))
      Ok("State updated")
    }
  }

  def receiveStateUpdate: Action[JsValue] = Action(parse.json) { request =>
    simulationState match {
      case None =>
        NotFound("No active simulation")
      case Some(state) =>
        val update = request.body.as[StateUpdate]
        state.addReceivedUpdate(update)
        broadcast(Json.obj("type" -> "STATE-UPDATE", "update" -> update))
        Ok("Update applied")
    }
  }

  def receiveError: Action[JsValue] = Action(parse.json) { request =>
    val message = request.body.as[String]
    broadcast(Json.obj("type" -> "ERROR-MESSAGE", "message" -> message))
    simulationState = None
    Ok("Error forwarded")
  }

  def receiveSuspended: Action[JsValue] = Action(parse.json) { request =>
    val value = request.body.as[Boolean]
    simulationState.foreach(_.setSuspended(value))
    broadcast(Json.obj("type" -> "SUSPENDED-UPDATE", "suspended" -> value))
    Ok("Suspended state updated")
  }

  // ---------------------------------------------------------------------------
  // Polling — called by the simulator process
  // ---------------------------------------------------------------------------

  def getNextAction: Action[AnyContent] = Action {
    val action =
      if (actionQueue.isEmpty) UIAction.nop else actionQueue.dequeue()
    Ok(Json.toJson(action))
  }

  def getKey: Action[AnyContent] = Action {
    Ok(
      Json.obj(
        "index" -> lastKey._1.toString,
        "key" -> lastKey._2.toString
      )
    )
  }

  def getConfig: Action[AnyContent] = Action {
    activeConfig match {
      case None         => NotFound("No config set")
      case Some(config) => Ok(Json.toJson(config))
    }
  }

  // ---------------------------------------------------------------------------
  // UI — called by the React frontend
  // ---------------------------------------------------------------------------

  def postAction: Action[JsValue] = Action(parse.json) { request =>
    val action = (request.body \ "action").as[String]
    val delay = (request.body \ "delay").asOpt[Int].getOrElse(0)
    val cycles = (request.body \ "cycles").asOpt[Int].getOrElse(1)
    actionQueue.enqueue(UIAction(action, delay, cycles))
    Ok("Action queued")
  }

  def postKey: Action[JsValue] = Action(parse.json) { request =>
    val ch = (request.body \ "key").as[String].headOption.getOrElse('\u0000')
    lastKey = (lastKey._1 + 1, ch)
    Ok("Key recorded")
  }

  def setConfig: Action[JsValue] = Action(parse.json) { request =>
    try {
      val config = (request.body \ "config").as[Config]
      activeConfig = Some(config)
      actionQueue.enqueue(UIAction("INITIALIZE", 0, 1))
      Ok("Config set")
    } catch {
      case _: Exception =>
        val msg = "Invalid config. Please check the syntax and try again."
        broadcast(Json.obj("type" -> "ERROR-MESSAGE", "message" -> msg))
        BadRequest("Invalid config")
    }
  }

  def getCurrentState: Action[AnyContent] = Action {
    simulationState match {
      case None        => NotFound("No active simulation")
      case Some(state) => Ok(state.toJson)
    }
  }

  def getAvailableConfigs: Action[AnyContent] = Action {
    if (defaultConfigs.isEmpty) NotFound("No default configs found")
    else Ok(Json.toJson(defaultConfigs))
  }

  def getAvailableCustomConfigs: Action[AnyContent] = Action {
    val customConfigs = customConfigsById.values.toVector.sortBy(_.id)
    //if (customConfigs.isEmpty) NotFound("No custom configs found")
    //else 
    Ok(Json.toJson(customConfigs))
  }

  def postCustomConfig: Action[JsValue] = Action(parse.json) { request =>
    (request.body \ "config").toOption match {
      case None =>
        BadRequest("Expected JSON object with 'config'")
      case Some(configJson) =>
        configJson
          .validate[Config]
          .fold(
            _ => BadRequest("Invalid config"),
            config => {
              validConfigIdRegex.findFirstIn(config.id) match {
                case None =>
                  BadRequest(
                    "Config id may only contain letters, numbers, '.', '_' and '-' characters"
                  )
                case Some(_) =>
                  customConfigsLock.synchronized {
                    if (defaultConfigs.exists(_.id == config.id)) {
                      Conflict(
                        s"Config id '${config.id}' already exists in default configs"
                      )
                    } else {
                      try {
                        val existedAlready =
                          customConfigsById.contains(config.id)
                        Files.createDirectories(customConfigDirectory)
                        val outputPath =
                          customConfigDirectory.resolve(s"${config.id}.json")
                        val payload = Json.prettyPrint(Json.toJson(config))
                        Files.writeString(
                          outputPath,
                          payload,
                          StandardCharsets.UTF_8
                        )
                        customConfigsById =
                          customConfigsById + (config.id -> config)
                        if (existedAlready) Ok("Custom config updated")
                        else Created("Custom config stored")
                      } catch {
                        case _: Exception =>
                          InternalServerError("Failed to persist custom config")
                      }
                    }
                  }
              }
            }
          )
    }
  }

  def deleteCustomConfig(id: String): Action[AnyContent] = Action {
    validConfigIdRegex.findFirstIn(id) match {
      case None =>
        BadRequest(
          "Config id may only contain letters, numbers, '.', '_' and '-' characters"
        )
      case Some(_) =>
        customConfigsLock.synchronized {
          if (defaultConfigs.exists(_.id == id)) {
            Conflict(
              s"Config id '$id' belongs to default configs and cannot be deleted"
            )
          } else if (!customConfigsById.contains(id)) {
            NotFound(s"Custom config with id '$id' not found")
          } else {
            try {
              val outputPath = customConfigDirectory.resolve(s"$id.json")
              if (Files.exists(outputPath)) {
                Files.delete(outputPath)
              }
              customConfigsById = customConfigsById - id
              Ok("Custom config deleted")
            } catch {
              case _: Exception =>
                InternalServerError("Failed to delete custom config")
            }
          }
        }
    }
  }

  // ---------------------------------------------------------------------------
  // Source file API
  // ---------------------------------------------------------------------------

  def getSourceFile: Action[JsValue] = Action(parse.json) { request =>
    val maybePath = (request.body \ "path").asOpt[String]
    maybePath match {
      case None =>
        BadRequest("Missing path")
      case Some(rawPath) =>
        resolveSourcePath(rawPath) match {
          case Left(error) =>
            error
          case Right(path) =>
            if (!Files.exists(path) || !Files.isRegularFile(path)) {
              NotFound("File not found")
            } else {
              val lines =
                Files.readAllLines(path, StandardCharsets.UTF_8).asScala
              Ok(Json.toJson(lines))
            }
        }
    }
  }

  def saveSourceFile: Action[JsValue] = Action(parse.json) { request =>
    val maybePath = (request.body \ "path").asOpt[String]
    val maybeContents = (request.body \ "contents").asOpt[Seq[String]]

    (maybePath, maybeContents) match {
      case (Some(rawPath), Some(contents)) =>
        resolveSourcePath(rawPath) match {
          case Left(error) =>
            error
          case Right(path) =>
            Option(path.getParent).foreach(parent =>
              Files.createDirectories(parent)
            )
            Files.write(
              path,
              contents.mkString("\n").getBytes(StandardCharsets.UTF_8)
            )
            Ok("Source file saved")
        }
      case _ =>
        BadRequest("Expected JSON object with path and contents")
    }
  }

  def getContributions: Action[AnyContent] = Action {
    val path = contributionsPath

    Files.readAllLines(path, StandardCharsets.UTF_8).asScala match {
      case lines => Ok(Json.toJson(lines))
    }
  }

  def setContributions: Action[JsValue] = Action(parse.json) { request =>
    val maybeContents = (request.body \ "contents").asOpt[Seq[String]]

    (maybeContents) match {
      case (Some(contents)) =>
        val path = contributionsPath
        Files.write(
          path,
          contents.mkString("\n").getBytes(StandardCharsets.UTF_8)
        )
        Ok("Source file saved")
      case _ =>
        BadRequest("Expected JSON object with contents")
    }
  }

  def getSubmission: Action[AnyContent] = Action {
    if (!Files.exists(sourceFileRoot) || !Files.isDirectory(sourceFileRoot)) {
      NotFound("Source file root not found")
    } else {
      try {
        val output = new ByteArrayOutputStream()

        Using.resource(new ZipOutputStream(output)) { zip =>
          addZipEntry(
            zip,
            "CONTRIBUTIONS.md",
            Files.readAllBytes(contributionsPath)
          )

          Using.resource(Files.walk(sourceFileRoot)) { paths =>
            paths
              .iterator()
              .asScala
              .filter(_ != sourceFileRoot)
              .toVector
              .sortBy(path => zipEntryName(sourceFileRoot.relativize(path)))
              .foreach { path =>
                val relativeName =
                  zipEntryName(sourceFileRoot.relativize(path))
                val entryName =
                  if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
                    s"programs/$relativeName/"
                  } else {
                    s"programs/$relativeName"
                  }

                if (Files.isDirectory(path, LinkOption.NOFOLLOW_LINKS)) {
                  zip.putNextEntry(new ZipEntry(entryName))
                  zip.closeEntry()
                } else if (
                  Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)
                ) {
                  addZipEntry(zip, entryName, Files.readAllBytes(path))
                }
              }
          }
        }

        // store file in the submissions folder with date and time
        val submissionsDir = submissionDirectory
        Files.createDirectories(submissionsDir)
        val timestamp = java.time.LocalDateTime.now()
          .format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"))
        val submissionPath = submissionsDir.resolve(s"submission_$timestamp.zip")
        Files.write(submissionPath, output.toByteArray)

        val attachmentName = s"attachment; filename=\"submission_$timestamp.zip\""

        Ok(output.toByteArray)
          .as("application/zip")
          .withHeaders(
            CONTENT_DISPOSITION -> attachmentName,
            ACCESS_CONTROL_EXPOSE_HEADERS -> CONTENT_DISPOSITION
          )
      } catch {
        case _: Exception =>
          InternalServerError("Failed to create submission zip")
      }
    }
  }
}
