package models

import play.api.libs.json._

case class StateUpdate(
  index: Int,
  pc: ValueUpdate[BigInt],
  register_updates: Map[Int, ValueUpdate[BigInt]],
  csr_updates: Map[BigInt, ValueUpdate[BigInt]],
  memory_updates: Map[BigInt, ValueUpdate[BigInt]],
  terminal_output: ValueUpdate[String],
  display_output: Map[(Int, Int), ValueUpdate[BigInt]]
) {
  def getPCValue: BigInt = pc.newValue

  def getRegisterValue(address: Int): Option[BigInt] =
    register_updates.get(address).map(_.newValue)

  def getCSRValue(address: BigInt): Option[BigInt] =
    csr_updates.get(address).map(_.newValue)

  def getMemoryValue(address: BigInt): Option[BigInt] =
    memory_updates.get(address).map(_.newValue)

  def getDisplayValue(address: (Int, Int)): Option[BigInt] =
    display_output.get(address).map(_.newValue)

  def merge(other: StateUpdate): StateUpdate = StateUpdate(
    index            = other.index,
    pc               = other.pc,
    register_updates = register_updates.filter(x => !other.register_updates.contains(x._1)) ++ other.register_updates,
    csr_updates      = csr_updates.filter(x => !other.csr_updates.contains(x._1)) ++ other.csr_updates,
    memory_updates   = memory_updates.filter(x => !other.memory_updates.contains(x._1)) ++ other.memory_updates,
    terminal_output  = ValueUpdate(
      terminal_output.oldValue,
      if (other.terminal_output.newValue == terminal_output.oldValue) terminal_output.newValue
      else other.terminal_output.newValue
    ),
    display_output   = display_output.filter(x => !other.display_output.contains(x._1)) ++ other.display_output
  )
}

object StateUpdate {

  implicit val reads: Reads[StateUpdate] = new Reads[StateUpdate] {
    def reads(json: JsValue): JsResult[StateUpdate] = {
      val index           = (json \ "index").as[Int]
      val pc              = (json \ "pc").as[ValueUpdate[BigInt]]
      val register_updates = (json \ "register_updates").as[Map[Int, ValueUpdate[BigInt]]]
      val csr_updates     = (json \ "csr_updates").as[Map[Long, ValueUpdate[BigInt]]].map(x => BigInt(x._1) -> x._2)
      val memory_updates  = (json \ "memory_updates").as[Map[Long, ValueUpdate[BigInt]]].map(x => BigInt(x._1) -> x._2)
      val terminal_output = (json \ "terminal_output").as[ValueUpdate[String]]
      val display_output  = (json \ "display_output")
        .as[Map[String, ValueUpdate[BigInt]]]
        .map { case (key, value) =>
          (key match { case s"($x,$y)" => (x.trim.toInt, y.trim.toInt) }) -> value
        }
      JsSuccess(StateUpdate(index, pc, register_updates, csr_updates, memory_updates, terminal_output, display_output))
    }
  }

  implicit val writes: Writes[StateUpdate] = new Writes[StateUpdate] {
    def writes(u: StateUpdate): JsValue = Json.obj(
      "index"           -> u.index,
      "pc"              -> u.pc,
      "register_updates" -> u.register_updates,
      "csr_updates"     -> u.csr_updates.map(x => x._1.longValue -> x._2),
      "memory_updates"  -> u.memory_updates.map(x => x._1.longValue -> x._2),
      "terminal_output" -> u.terminal_output,
      "display_output"  -> u.display_output.map { case ((x, y), v) => s"($x,$y)" -> v }
    )
  }
}
