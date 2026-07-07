package project3.utils.models

import sttp.client4.quick._
import sttp.client4.Response
import play.api.libs.json._
import scala.collection.mutable

case class State(
    val initialState: InitialState,
    var updates: List[StateUpdate],
    var suspended: Boolean = false
) {
  private val memoryCache = mutable.Map.from(initialState.memory)
  private val registerCache = mutable.Map.from(initialState.registers)
  private val csrCache = mutable.Map.from(initialState.csrs)
  private val displayCache = mutable.Map.empty[(Int, Int), BigInt]

  private var pcCache = initialState.pc
  private var terminalOutputCache = ""

  def isSuspended = suspended
  def setSuspended(value: Boolean) = {
    suspended = value
  }

  var pendingUpdate = Option.empty[StateUpdate]
  var next_index = updates.lastOption.map(_.index + 1).getOrElse(1)
  var next_key: (Boolean, Int, Char) = (false, 0, '\u0000')
  var terminal_ready_timer = BigInt(0)

  updates.foreach(applyUpdateToCache)

  private def applyUpdateToCache(update: StateUpdate): Unit = {
    pcCache = update.pc.newValue
    terminalOutputCache = update.terminal_output.newValue
    update.memory_updates.foreach { case (address, value) =>
      memoryCache(address) = value.newValue
    }
    update.register_updates.foreach { case (address, value) =>
      registerCache(address) = value.newValue
    }
    update.csr_updates.foreach { case (address, value) =>
      csrCache(address) = value.newValue
    }
    update.display_output.foreach { case (address, value) =>
      displayCache(address) = value.newValue
    }
  }

  def addUpdate(update: StateUpdate) = {
    if (pendingUpdate.isEmpty) {
      pendingUpdate = Option(update)
    } else {
      pendingUpdate = Option(pendingUpdate.get.merge(update))
    }
  }

  def addMemoryUpdate(mem_update: Map[BigInt, ValueUpdate[BigInt]]) = {
    if (pendingUpdate.isEmpty) {
      pendingUpdate = Option(
        new StateUpdate(
          next_index,
          new ValueUpdate(getPCValue(), getPCValue()),
          Map(),
          Map(),
          mem_update,
          new ValueUpdate(getTerminalOutput(), getTerminalOutput()),
          Map()
        )
      )
    } else {
      val update = new StateUpdate(
        pendingUpdate.get.index,
        new ValueUpdate(getPCValue(), getPCValue()),
        Map(),
        Map(),
        mem_update,
        new ValueUpdate(getTerminalOutput(), getTerminalOutput()),
        Map()
      )
      pendingUpdate = Option(pendingUpdate.get.merge(update))
    }
  }

  def addTerminalOutput(output: Char) = {
    if (pendingUpdate.isEmpty) {
      pendingUpdate = Option(
        new StateUpdate(
          next_index,
          new ValueUpdate(getPCValue(), getPCValue()),
          Map(),
          Map(),
          Map(),
          new ValueUpdate(getTerminalOutput(), getTerminalOutput() + output),
          Map()
        )
      )
    } else {
      val update = new StateUpdate(
        pendingUpdate.get.index,
        new ValueUpdate(getPCValue(), getPCValue()),
        Map(),
        Map(),
        Map(),
        new ValueUpdate(getTerminalOutput(), getTerminalOutput() + output),
        Map()
      )
      pendingUpdate = Option(pendingUpdate.get.merge(update))
    }
  }

  def addDisplayOutput(address: (Int, Int), value: BigInt) = {
    if (pendingUpdate.isEmpty) {
      pendingUpdate = Option(
        new StateUpdate(
          next_index,
          new ValueUpdate(getPCValue(), getPCValue()),
          Map(),
          Map(),
          Map(),
          new ValueUpdate(getTerminalOutput(), getTerminalOutput()),
          Map((address, new ValueUpdate(getDisplayValue(address), value)))
        )
      )
    } else {
      val update = new StateUpdate(
        pendingUpdate.get.index,
        new ValueUpdate(getPCValue(), getPCValue()),
        Map(),
        Map(),
        Map(),
        new ValueUpdate(getTerminalOutput(), getTerminalOutput()),
        Map((address, new ValueUpdate(getDisplayValue(address), value)))
      )
      pendingUpdate = Option(pendingUpdate.get.merge(update))
    }
  }

  def getInstruction(address: BigInt): BigInt = {
    initialState.getInstruction(address)
  }

  def getMemoryValue(
      address: BigInt,
      includePending: Boolean = false
  ): BigInt = {
    if (includePending && !pendingUpdate.isEmpty) {
      return pendingUpdate.get
        .getMemoryValue(address)
        .getOrElse(getMemoryValue(address, false))
    }
    return memoryCache.getOrElse(address, BigInt(0))
  }

  def getRegisterValue(address: Int): BigInt = {
    registerCache.getOrElse(address, BigInt(0))
  }

  def getCSRValue(address: BigInt): BigInt = {
    csrCache.getOrElse(address, BigInt(0))
  }

  def getPCValue(): BigInt = {
    pcCache
  }

  def getTerminalOutput(): String = {
    terminalOutputCache
  }

  def getDisplayValue(address: (Int, Int)): BigInt = {
    displayCache.getOrElse(address, BigInt(0))
  }

  def flushUpdate(): Option[StateUpdate] = {
    if (!pendingUpdate.isEmpty) {
      val update = pendingUpdate.get
      updates = updates :+ update
      applyUpdateToCache(update)
      pendingUpdate = Option.empty
      next_index += 1
      return Option(update)
    }
    return Option.empty
  }
}

object State {
  implicit val reads: Reads[State] = new Reads[State] {
    def reads(json: JsValue): JsResult[State] = {
      val initialState = (json \ "initial_state").as[InitialState]
      val updates = (json \ "updates").as[List[StateUpdate]]
      val suspended = (json \ "suspended").as[Boolean]
      JsSuccess(new State(initialState, updates, suspended))
    }
  }

  implicit val writes: Writes[State] = new Writes[State] {
    def writes(state: State): JsValue = {
      Json.obj(
        "initial_state" -> Json.toJson(state.initialState),
        "updates" -> Json.toJson(state.updates),
        "suspended" -> Json.toJson(state.suspended)
      )
    }
  }
}
