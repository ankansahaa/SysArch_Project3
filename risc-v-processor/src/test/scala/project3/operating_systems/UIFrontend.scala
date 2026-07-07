package project3.operating_systems

import sttp.client4.Response
import sttp.client4.quick._
import play.api.libs.json._
import project3.utils.models.{
  InitialState,
  Config,
  UIAction,
  StateUpdate,
  State
}
import com.google.gson.JsonArray

class UIFrontend extends TestFrontend {
  val host = sys.env.get("HOST").getOrElse("localhost")
  val port = sys.env.get("PLAY_HTTP_PORT").getOrElse("9000").toInt
  def getAction(): UIAction = {
    val response: Response[String] =
      quickRequest.get(uri"http://$host:$port/get-next-action").send()
    val action = Json.parse(response.body).as[UIAction]
    return action
  }

  def getKey(): (Int, Char) = {
    val response: Response[String] =
      quickRequest.get(uri"http://$host:$port/get-key").send()
    val json = Json.parse(response.body)
    val key = (json \ "key").as[String].charAt(0)
    val index = (json \ "index").as[String].toInt
    (index, key)
  }

  def publishCurrentState(state: State) = {
    val response: Response[String] = quickRequest
      .post(uri"http://$host:$port/current-state")
      .header("Content-Type", "application/json")
      .body(Json.toJson(state).toString())
      .send()
  }

  def publishInitialState(initialState: InitialState) = {
    val response: Response[String] = quickRequest
      .post(uri"http://$host:$port/initial-state")
      .header("Content-Type", "application/json")
      .body(Json.toJson(initialState).toString())
      .send()
  }

  def publishUpdate(update: StateUpdate) = {
    val response: Response[String] = quickRequest
      .post(uri"http://$host:$port/state-update")
      .header("Content-Type", "application/json")
      .body(Json.toJson(update).toString())
      .send()
  }

  def getConfig(): Config = {
    val response: Response[String] =
      quickRequest.get(uri"http://$host:$port/get-config").send()
    if (response.code.code != 200) {
      return null
    }
    println(response.body)
    val config = Json.parse(response.body).as[Config]
    return config
  }

  def publishError(error: String) = {
    val response: Response[String] = quickRequest
      .post(uri"http://$host:$port/set-error")
      .header("Content-Type", "application/json")
      .body(Json.toJson(error).toString())
      .send()
  }

  override def setSuspended(value: Boolean) = {
    val response: Response[String] = quickRequest
      .post(uri"http://$host:$port/set-suspended")
      .header("Content-Type", "application/json")
      .body(Json.toJson(value).toString())
      .send()
  }

  override def getProgram(path: String): String = {
    val jsonBody = Json.obj("path" -> path)
    val response: Response[String] = quickRequest
      .post(uri"http://$host:$port/get-source-file")
      .header("Content-Type", "application/json")
      .body(jsonBody.toString())
      .send()
    println(response.body)
    val json = Json.parse(response.body).validate[Seq[String]] match {
      case JsSuccess(contentSeq, _) =>
        contentSeq.mkString("\n")
      case JsError(_) =>
        // Try to parse as a single string (fallback)
        publishError(f"Failed to load source file at path: $path")
        return ""
    }
    return json
  }

  def mayExit(): Boolean = false

  def getCategory(): String = {
    "The UI"
  }

  def getName(): String = {
    "display the simulation results"
  }
}
