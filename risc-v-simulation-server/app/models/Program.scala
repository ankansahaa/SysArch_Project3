package models

import play.api.libs.json._
import play.twirl.api.TwirlFeatureImports.TwirlDefaultValue

case class Program(
    name: String,
    baseAddress: BigInt,
    instructions: Map[BigInt, (BigInt, String, List[String])]
) {
  def getInstruction(address: BigInt): Option[BigInt] =
    instructions.get(address) match {
      case Some((binary, _, _)) => Some(binary)
      case None                 => None
    }
}

object Program {

  implicit val reads: Reads[Program] = new Reads[Program] {
    def reads(json: JsValue): JsResult[Program] = {
      val name = (json \ "name").as[String]
      val baseAddress = BigInt((json \ "base_address").as[Long])
      val instructions = (json \ "instructions")
        .as[Map[Long, (Long, String, List[String])]]
        .map(x => BigInt(x._1) -> (BigInt(x._2._1), x._2._2, x._2._3))
      JsSuccess(Program(name, baseAddress, instructions))
    }
  }

  implicit val writes: Writes[Program] = new Writes[Program] {
    def writes(p: Program): JsValue = Json.obj(
      "name" -> p.name,
      "base_address" -> p.baseAddress.longValue,
      "instructions" -> Json.toJson(
        p.instructions.map(x =>
          x._1.longValue -> (x._2._1.longValue, x._2._2, x._2._3)
        )
      )
    )
  }
}
