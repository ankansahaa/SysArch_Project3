package project3.operating_systems

import project3.utils.models.{
  InitialState,
  Config,
  UIAction,
  StateUpdate,
  State
}
import scala.io.Source

abstract class TestFrontend {
  def getKey(): (Int, Char)
  def getAction(): UIAction
  def publishCurrentState(state: State): Unit
  def publishInitialState(initialState: InitialState): Unit
  def publishUpdate(update: StateUpdate): Unit
  def getConfig(): Config
  def publishError(error: String): Unit
  def mayExit(): Boolean
  def getCategory(): String
  def getName(): String
  def getTerminalReady(): Option[Boolean] = Option.empty
  def setSuspended(value: Boolean): Unit = {}

  def getProgram(path: String): String = {
    val source = Source.fromFile(path)
    val string =
      try source.mkString
      finally source.close()
    return string
  }
}
