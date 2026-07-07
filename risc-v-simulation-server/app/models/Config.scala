package models

import play.api.libs.json._

case class Config(
  name: String,
  id: String,
  mtime: BigInt,
  mtimeh: BigInt,
  mtimecmp: BigInt,
  mtimecmph: BigInt,
  keyboard_ready: BigInt,
  keyboard_data: BigInt,
  terminal_ready: BigInt,
  terminal_data: BigInt,
  display: BigInt,
  initial_pc: BigInt,
  machine_program_file: String,
  user_program_files: Map[BigInt, (String, String)],
  initial_memory: Map[BigInt, BigInt],
  terminal_delay: BigInt
)

object Config {

  implicit val reads: Reads[Config] = new Reads[Config] {
    def reads(json: JsValue): JsResult[Config] =
      JsSuccess(Config(
        name                 = (json \ "name").as[String],
        id                   = (json \ "id").as[String],
        mtime                = hexField(json, "memory_mapped_registers", "mtime"),
        mtimeh               = hexField(json, "memory_mapped_registers", "mtimeh"),
        mtimecmp             = hexField(json, "memory_mapped_registers", "mtimecmp"),
        mtimecmph            = hexField(json, "memory_mapped_registers", "mtimecmph"),
        keyboard_ready       = hexField(json, "memory_mapped_registers", "keyboard_ready"),
        keyboard_data        = hexField(json, "memory_mapped_registers", "keyboard_data"),
        terminal_ready       = hexField(json, "memory_mapped_registers", "terminal_ready"),
        terminal_data        = hexField(json, "memory_mapped_registers", "terminal_data"),
        display              = hexField(json, "memory_mapped_registers", "display"),
        initial_pc           = BigInt((json \ "initial_pc").as[String].stripPrefix("0x"), 16),
        machine_program_file = (json \ "os_program_file").as[String],
        user_program_files   = (json \ "user_programs")
          .as[Seq[Map[String, String]]]
          .map(x => BigInt(x("address").stripPrefix("0x"), 16) -> (x("name"), x("file")))
          .toMap,
        initial_memory       = (json \ "initial_memory")
          .as[Map[String, String]]
          .map(x => BigInt(x._1.stripPrefix("0x"), 16) -> BigInt(x._2.stripPrefix("0x"), 16)),
        terminal_delay       = BigInt((json \ "terminal_delay").as[String])
      ))

    private def hexField(json: JsValue, obj: String, field: String): BigInt =
      BigInt((json \ obj \ field).as[String].stripPrefix("0x"), 16)
  }

  implicit val writes: Writes[Config] = new Writes[Config] {
    def writes(c: Config): JsValue = Json.obj(
      "name" -> c.name,
      "id"   -> c.id,
      "memory_mapped_registers" -> Json.obj(
        "mtime"          -> hex(c.mtime),
        "mtimeh"         -> hex(c.mtimeh),
        "mtimecmp"       -> hex(c.mtimecmp),
        "mtimecmph"      -> hex(c.mtimecmph),
        "keyboard_ready" -> hex(c.keyboard_ready),
        "keyboard_data"  -> hex(c.keyboard_data),
        "terminal_ready" -> hex(c.terminal_ready),
        "terminal_data"  -> hex(c.terminal_data),
        "display"        -> hex(c.display)
      ),
      "initial_pc"      -> hex(c.initial_pc),
      "os_program_file" -> c.machine_program_file,
      "user_programs"   -> c.user_program_files.map { case (addr, (name, file)) =>
        Map("address" -> hex(addr), "name" -> name, "file" -> file)
      },
      "initial_memory"  -> Json.obj(
        c.initial_memory.map { case (k, v) => hex(k) -> Json.toJsFieldJsValueWrapper(JsString(hex(v))) }.toSeq: _*
      ),
      "terminal_delay" -> c.terminal_delay.toString
    )

    private def hex(v: BigInt): String = "0x" + v.toString(16)
  }
}
