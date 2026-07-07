package models

import play.api.libs.json._

/** Server-side view of the simulation session. Holds the initial state
  * plus every received update so it can provide full replays to late-
  * connecting WebSocket clients.
  */
class SimulationState(val initialState: InitialState) {

  private var _updates: Vector[StateUpdate] = Vector.empty
  private var _pendingUpdate: Option[StateUpdate] = None
  private var _nextIndex: Int = 1
  private var _key: (Int, Char) = (0, '\u0000')
  private var _suspended: Boolean = false

  def updates: Vector[StateUpdate] = _updates

  def addReceivedUpdate(update: StateUpdate): Unit =
    _updates = _updates :+ update

  def addUpdate(update: StateUpdate): Unit =
    _pendingUpdate = Some(_pendingUpdate.fold(update)(_.merge(update)))

  def flushUpdate(): Option[StateUpdate] =
    _pendingUpdate.map { update =>
      _updates = _updates :+ update
      _pendingUpdate = None
      _nextIndex += 1
      update
    }

  def setKey(ch: Char): Unit =
    _key = (_key._1 + 1, ch)

  def key: (Int, Char) = _key

  def getPCValue: BigInt =
    _updates.lastOption.fold(initialState.pc)(_.getPCValue)

  def setSuspended(value: Boolean): Unit = {
    _suspended = value
  }

  def toJson: JsValue = Json.obj(
    "initial_state" -> initialState,
    "updates"       -> _updates,
    "suspended"     -> _suspended
  )
}

/** Lightweight snapshot for serialising to a newly connecting client. */
case class StateSnapshot(initialState: InitialState, updates: Vector[StateUpdate], suspended: Boolean)

object StateSnapshot {
  implicit val reads: Reads[StateSnapshot] = (json: JsValue) =>
    for {
      initial <- (json \ "initial_state").validate[InitialState]
      updates <- (json \ "updates").validate[Vector[StateUpdate]]
      suspended <- (json \ "suspended").validate[Boolean]
    } yield StateSnapshot(initial, updates, suspended)

  implicit val writes: Writes[StateSnapshot] = new Writes[StateSnapshot] {
    def writes(s: StateSnapshot): JsValue = Json.obj(
      "initial_state" -> s.initialState,
      "updates"       -> s.updates,
      "suspended"     -> s.suspended
    )
  }
}
