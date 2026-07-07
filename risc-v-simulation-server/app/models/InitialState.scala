package models

import play.api.libs.json._

case class InitialState(
  machine_program: Program,
  user_programs: List[Program],
  registers: Map[Int, BigInt],
  csrs: Map[BigInt, BigInt],
  memory: Map[BigInt, BigInt],
  pc: BigInt
)

object InitialState {

  implicit val reads: Reads[InitialState] = new Reads[InitialState] {
    def reads(json: JsValue): JsResult[InitialState] = {
      val machine_program = (json \ "machine_program").as[Program]
      val user_programs   = (json \ "user_programs").as[List[Program]]
      val registers       = (json \ "registers").as[Map[Int, Long]].map(x => x._1 -> BigInt(x._2))
      val csrs            = (json \ "csrs").as[Map[Long, Long]].map(x => BigInt(x._1) -> BigInt(x._2))
      val memory          = (json \ "memory").as[Map[Long, Long]].map(x => BigInt(x._1) -> BigInt(x._2))
      val pc              = BigInt((json \ "pc").as[Long])
      JsSuccess(InitialState(machine_program, user_programs, registers, csrs, memory, pc))
    }
  }

  implicit val writes: Writes[InitialState] = new Writes[InitialState] {
    def writes(s: InitialState): JsValue = Json.obj(
      "machine_program" -> s.machine_program,
      "user_programs"   -> s.user_programs,
      "registers"       -> s.registers.map(x => x._1 -> x._2.longValue),
      "csrs"            -> s.csrs.map(x => x._1.longValue -> x._2.longValue),
      "memory"          -> s.memory.map(x => x._1.longValue -> x._2.longValue),
      "pc"              -> s.pc.longValue
    )
  }
}
