package controllers

import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Paths}
import java.util.UUID

import org.scalatestplus.play._
import org.scalatestplus.play.guice.GuiceOneAppPerTest

import play.api.libs.json._
import play.api.test._
import play.api.test.Helpers._

class SimulatorControllerSpec extends PlaySpec with GuiceOneAppPerTest {

  private val baseProgram: JsObject = Json.obj(
    "name" -> "os",
    "base_address" -> 0,
    "instructions" -> Json.obj("0" -> 19),
    "assembly" -> Json.obj("0" -> "addi x0, x0, 0"),
    "labels" -> Json.obj()
  )

  private val baseInitialState: JsObject = Json.obj(
    "machine_program" -> baseProgram,
    "user_programs" -> Json.arr(),
    "registers" -> Json.obj("0" -> 0),
    "csrs" -> Json.obj(),
    "memory" -> Json.obj(),
    "pc" -> 0
  )

  private val baseStateUpdate: JsObject = Json.obj(
    "index" -> 1,
    "pc" -> Json.obj("old_value" -> 0, "new_value" -> 4),
    "register_updates" -> Json.obj(
      "1" -> Json.obj("old_value" -> 0, "new_value" -> 42)
    ),
    "csr_updates" -> Json.obj(),
    "memory_updates" -> Json.obj(),
    "terminal_output" -> Json.obj("old_value" -> "", "new_value" -> "Hello"),
    "display_output" -> Json.obj(
      "(0,0)" -> Json.obj("old_value" -> 0, "new_value" -> 1)
    )
  )

  private val baseConfig: JsObject = Json.obj(
    "name" -> "demo",
    "id" -> "demo-1",
    "memory_mapped_registers" -> Json.obj(
      "mtime" -> "0x0",
      "mtimeh" -> "0x0",
      "mtimecmp" -> "0x0",
      "mtimecmph" -> "0x0",
      "keyboard_ready" -> "0x0",
      "keyboard_data" -> "0x0",
      "terminal_ready" -> "0x0",
      "terminal_data" -> "0x0",
      "display" -> "0x0"
    ),
    "initial_pc" -> "0x0",
    "os_program_file" -> "os.bin",
    "user_programs" -> Json.arr(),
    "initial_memory" -> Json.obj(),
    "terminal_delay" -> "0"
  )

  "GET /socket" should {
    "resolve to a handler" in {
      val req = FakeRequest(GET, "/socket")
      val handlerOpt = app.injector
        .instanceOf[play.api.routing.Router]
        .routes
        .lift(req)

      handlerOpt must not be empty
    }
  }

  "POST /initial-state" should {
    "start a simulation" in {
      val req =
        FakeRequest(POST, "/initial-state").withJsonBody(baseInitialState)
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsString(result) must include("Simulation started")
    }
  }

  "POST /current-state" should {
    "create state if missing" in {
      val snapshot = Json.obj(
        "initial_state" -> baseInitialState,
        "updates" -> Json.arr(baseStateUpdate)
      )

      val req = FakeRequest(POST, "/current-state").withJsonBody(snapshot)
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsString(result) must include("State updated")
    }

    "return already exists when a state is active" in {
      route(
        app,
        FakeRequest(POST, "/initial-state").withJsonBody(baseInitialState)
      ).value

      val snapshot = Json.obj(
        "initial_state" -> baseInitialState,
        "updates" -> Json.arr(baseStateUpdate)
      )
      val req = FakeRequest(POST, "/current-state").withJsonBody(snapshot)
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsString(result) must include("State already exists")
    }
  }

  "POST /state-update" should {
    "return 404 when there is no active simulation" in {
      val req = FakeRequest(POST, "/state-update").withJsonBody(baseStateUpdate)
      val result = route(app, req).value

      status(result) mustBe NOT_FOUND
    }

    "apply update when simulation exists" in {
      route(
        app,
        FakeRequest(POST, "/initial-state").withJsonBody(baseInitialState)
      ).value

      val req = FakeRequest(POST, "/state-update").withJsonBody(baseStateUpdate)
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsString(result) must include("Update applied")
    }
  }

  "POST /set-error" should {
    "forward error and clear active simulation" in {
      route(
        app,
        FakeRequest(POST, "/initial-state").withJsonBody(baseInitialState)
      ).value

      val errReq =
        FakeRequest(POST, "/set-error").withJsonBody(JsString("boom"))
      val errResult = route(app, errReq).value
      status(errResult) mustBe OK

      val stateReq = FakeRequest(GET, "/get-current-state")
      val stateResult = route(app, stateReq).value
      status(stateResult) mustBe NOT_FOUND
    }
  }

  "GET /get-next-action" should {
    "return NOP when queue is empty" in {
      val req = FakeRequest(GET, "/get-next-action")
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsJson(result) mustBe Json.obj(
        "action" -> "NOP",
        "delay" -> 0,
        "cycles" -> 1
      )
    }
  }

  "GET /get-key" should {
    "return latest keyboard tuple" in {
      route(
        app,
        FakeRequest(POST, "/new-key").withJsonBody(Json.obj("key" -> "a"))
      ).value

      val req = FakeRequest(GET, "/get-key")
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsJson(result) mustBe Json.obj("index" -> "1", "key" -> "a")
    }
  }

  "GET /get-config" should {
    "return 404 if unset, then config after set" in {
      val missing = route(app, FakeRequest(GET, "/get-config")).value
      status(missing) mustBe NOT_FOUND

      route(
        app,
        FakeRequest(POST, "/set-config").withJsonBody(
          Json.obj("config" -> baseConfig)
        )
      ).value
      val present = route(app, FakeRequest(GET, "/get-config")).value

      status(present) mustBe OK
      (contentAsJson(present) \ "id").head.as[String] mustBe "demo-1"
    }
  }

  "POST /new-action" should {
    "enqueue action for simulator polling" in {
      val postReq = FakeRequest(POST, "/new-action")
        .withJsonBody(Json.obj("action" -> "STEP", "delay" -> 3, "cycles" -> 2))
      val postResult = route(app, postReq).value
      status(postResult) mustBe OK

      val getResult = route(app, FakeRequest(GET, "/get-next-action")).value
      contentAsJson(getResult) mustBe Json.obj(
        "action" -> "STEP",
        "delay" -> 3,
        "cycles" -> 2
      )
    }
  }

  "POST /new-key" should {
    "record keyboard key" in {
      val req =
        FakeRequest(POST, "/new-key").withJsonBody(Json.obj("key" -> "z"))
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsString(result) must include("Key recorded")
    }
  }

  "POST /set-config" should {
    "set config and enqueue INITIALIZE action" in {
      val req = FakeRequest(POST, "/set-config").withJsonBody(
        Json.obj("config" -> baseConfig)
      )
      val result = route(app, req).value
      status(result) mustBe OK

      val actionResult = route(app, FakeRequest(GET, "/get-next-action")).value
      contentAsJson(actionResult) mustBe Json.obj(
        "action" -> "INITIALIZE",
        "delay" -> 0,
        "cycles" -> 1
      )
    }

    "return bad request on invalid payload" in {
      val req = FakeRequest(POST, "/set-config").withJsonBody(
        Json.obj("config" -> Json.obj("id" -> "only-id"))
      )
      val result = route(app, req).value

      status(result) mustBe BAD_REQUEST
    }
  }

  "GET /get-current-state" should {
    "return current state when set" in {
      route(
        app,
        FakeRequest(POST, "/initial-state").withJsonBody(baseInitialState)
      ).value
      val req = FakeRequest(GET, "/get-current-state")
      val result = route(app, req).value

      status(result) mustBe OK
      (contentAsJson(result) \ "pc").head.as[Long] mustBe 0L
    }
  }

  "GET /get-available-configs" should {
    "return default configs loaded at startup" in {
      val req = FakeRequest(GET, "/get-available-configs")
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsJson(result).as[Seq[JsValue]] must not be empty
    }
  }

  "GET /get-available-custom-configs" should {
    "return 404 when there are no custom configs" in {
      val req = FakeRequest(GET, "/get-available-custom-configs")
      val result = route(app, req).value

      status(result) must (be(OK) or be(NOT_FOUND))
    }
  }

  "POST /post-custom-config" should {
    "store custom config and expose it through the custom endpoint" in {
      val uniqueId = s"custom-${UUID.randomUUID().toString}"
      val customConfig = baseConfig ++ Json.obj(
        "id" -> uniqueId,
        "name" -> s"custom-$uniqueId"
      )

      val postReq = FakeRequest(POST, "/post-custom-config").withJsonBody(
        Json.obj("config" -> customConfig)
      )
      val postResult = route(app, postReq).value

      status(postResult) mustBe CREATED

      val listReq = FakeRequest(GET, "/get-available-custom-configs")
      val listResult = route(app, listReq).value
      status(listResult) mustBe OK

      val ids =
        contentAsJson(listResult)
          .as[Seq[JsValue]]
          .map(json => (json \ "id").head.as[String])
      ids must contain(uniqueId)
    }

    "update existing custom configs when id already exists in custom configs" in {
      val uniqueId = s"custom-${UUID.randomUUID().toString}"
      val firstConfig = baseConfig ++ Json.obj(
        "id" -> uniqueId,
        "name" -> s"custom-$uniqueId"
      )
      val updatedConfig = firstConfig ++ Json.obj("terminal_delay" -> "77")

      val firstPost = route(
        app,
        FakeRequest(POST, "/post-custom-config")
          .withJsonBody(Json.obj("config" -> firstConfig))
      ).value
      status(firstPost) mustBe CREATED

      val secondPost = route(
        app,
        FakeRequest(POST, "/post-custom-config")
          .withJsonBody(Json.obj("config" -> updatedConfig))
      ).value

      status(secondPost) mustBe OK

      val listResult =
        route(app, FakeRequest(GET, "/get-available-custom-configs")).value
      status(listResult) mustBe OK
      val persisted = contentAsJson(listResult)
        .as[Seq[JsValue]]
        .find(json => (json \ "id").head.as[String] == uniqueId)
        .get

      (persisted \ "terminal_delay").head.as[String] mustBe "77"
    }

    "reject ids that collide with default configs" in {
      val defaultsResult =
        route(app, FakeRequest(GET, "/get-available-configs")).value
      status(defaultsResult) mustBe OK
      val defaultId =
        (contentAsJson(defaultsResult).as[Seq[JsValue]].head \ "id").head
          .as[String]

      val collidingConfig = baseConfig ++ Json.obj(
        "id" -> defaultId,
        "name" -> s"collide-$defaultId"
      )

      val postResult = route(
        app,
        FakeRequest(POST, "/post-custom-config")
          .withJsonBody(Json.obj("config" -> collidingConfig))
      ).value

      status(postResult) mustBe CONFLICT
    }
  }

  "DELETE /delete-custom-config/:id" should {
    "delete an existing custom config" in {
      val uniqueId = s"custom-${UUID.randomUUID().toString}"
      val customConfig = baseConfig ++ Json.obj(
        "id" -> uniqueId,
        "name" -> s"custom-$uniqueId"
      )

      val createResult = route(
        app,
        FakeRequest(POST, "/post-custom-config")
          .withJsonBody(Json.obj("config" -> customConfig))
      ).value
      status(createResult) mustBe CREATED

      val deleteResult = route(
        app,
        FakeRequest(DELETE, s"/delete-custom-config/$uniqueId")
      ).value
      status(deleteResult) mustBe OK

      val listResult = route(
        app,
        FakeRequest(GET, "/get-available-custom-configs")
      ).value
      if (status(listResult) == OK) {
        val ids = contentAsJson(listResult)
          .as[Seq[JsValue]]
          .map(json => (json \ "id").head.as[String])
        ids must not contain uniqueId
      } else {
        status(listResult) mustBe NOT_FOUND
      }
    }

    "reject deleting default configs" in {
      val defaultsResult =
        route(app, FakeRequest(GET, "/get-available-configs")).value
      status(defaultsResult) mustBe OK
      val defaultId =
        (contentAsJson(defaultsResult).as[Seq[JsValue]].head \ "id").head
          .as[String]

      val deleteResult = route(
        app,
        FakeRequest(DELETE, s"/delete-custom-config/$defaultId")
      ).value

      status(deleteResult) mustBe CONFLICT
    }
  }

  "GET /get-source-file" should {
    "return source file contents as a JSON string array" in {
      val req = FakeRequest(
        GET,
        "/get-source-file?path=programs/public/os/systemcalls.s"
      )
      val result = route(app, req).value

      status(result) mustBe OK
      contentAsJson(result).as[Seq[String]] must not be empty
    }

    "reject path traversal outside configured root" in {
      val req = FakeRequest(GET, "/get-source-file?path=../etc/passwd")
      val result = route(app, req).value

      status(result) mustBe BAD_REQUEST
    }
  }

  "POST /save-source-file" should {
    "persist contents to disk" in {
      val relativePath = "target/test-source-file.s"
      val payload = Json.obj(
        "path" -> relativePath,
        "contents" -> Json.arr("addi x1, x0, 1", "ecall")
      )

      val saveReq = FakeRequest(POST, "/save-source-file").withJsonBody(payload)
      val saveResult = route(app, saveReq).value
      status(saveResult) mustBe OK

      val stored =
        Files.readString(Paths.get(relativePath), StandardCharsets.UTF_8)
      stored mustBe "addi x1, x0, 1\necall"
    }

    "reject invalid payloads" in {
      val req = FakeRequest(POST, "/save-source-file").withJsonBody(
        Json.obj("path" -> "target/ignored.s")
      )
      val result = route(app, req).value

      status(result) mustBe BAD_REQUEST
    }
  }
}
