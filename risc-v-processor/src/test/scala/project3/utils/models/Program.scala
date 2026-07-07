package project3.utils.models

import play.api.libs.json._

case class Program(
    name: String,
    baseAddress: BigInt,
    instructions: Map[BigInt, (BigInt, String, List[String])]
) {
  def getInstruction(address: BigInt): Option[(BigInt)] = {
    if (instructions.keySet.contains(address)) {
      return Option(instructions(address)._1)
    } else {
      return Option.empty
    }
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
      JsSuccess(new Program(name, baseAddress, instructions))
    }
  }

  implicit val writes: Writes[Program] = new Writes[Program] {
    def writes(program: Program): JsValue = {
      Json.obj(
        "name" -> program.name,
        "base_address" -> Json.toJson(program.baseAddress.longValue),
        "instructions" -> Json.toJson(
          program.instructions.map(x =>
            x._1.longValue -> (x._2._1.longValue, x._2._2, x._2._3)
          )
        )
      )
    }
  }
}
