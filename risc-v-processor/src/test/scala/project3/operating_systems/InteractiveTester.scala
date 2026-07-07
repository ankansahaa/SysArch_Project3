package project3.operating_systems

import chisel3._
import chisel3.simulator.scalatest.ChiselSim
import org.scalatest._
import org.scalatest.flatspec.AnyFlatSpec
import org.scalatest.matchers.should.Matchers

import scala.io.Source
import scala.collection.mutable

import sttp.client4.quick._
import sttp.client4.Response
import play.api.libs.json._

import RISCV.utils.assembler._

import project3._
import RISCV.model._
import project3.utils.models.{
  ValueUpdate,
  InitialState,
  Program,
  Config,
  StateUpdate,
  State,
  UIAction
}

trait TesterBase extends AnyFlatSpec with ChiselSim with Matchers {

  def frontends: mutable.Queue[TestFrontend] = mutable.Queue(new UIFrontend())
  var frontend: TestFrontend = frontends.dequeue()

  def getCategory(): String = "The UI"
  def getName(): String = "allow you to control the simulation interactively"
  def getImmatrikulationNumber(): BigInt = BigInt(0)

  def loadProgram(
      name: String,
      path: String,
      base: BigInt,
      config: Config,
      frontend: TestFrontend
  ): Program = {
    val string = frontend.getProgram(path)
    println(
      s"Loading program $name from path $path with base address ${base.toString(16)}"
    )
    println(string)
    var labels = Map[String, String](
      "mtime" -> config.mtime.toString(16),
      "mtimeh" -> config.mtimeh.toString(16),
      "mtimecmp" -> config.mtimecmp.toString(16),
      "mtimecmph" -> config.mtimecmph.toString(16),
      "keyboard_ready" -> config.keyboard_ready.toString(16),
      "keyboard_data" -> config.keyboard_data.toString(16),
      "terminal_ready" -> config.terminal_ready.toString(16),
      "terminal_data" -> config.terminal_data.toString(16),
      "display" -> config.display.toString(16)
    )
    val user_labels =
      config.user_program_files.map(x => x._2._1 -> x._1.toString(16)).toMap
    labels =
      labels ++ user_labels ++ Map("os" -> config.initial_pc.toString(16))
    val (assembled, assembled_labels) =
      RISCVAssembler.mappingFromString(string, base, labels)
    // unify adress, machine code, assembly and corresponding labels.
    val instructions = assembled
      .map(x =>
        x._1 ->
          (
            x._2._2, // binary code
            x._2._1, // assembly
            assembled_labels
              .filter { case (label, address) => BigInt(address, 16) == x._1 }
              .map { case (label, _) => label }
              .toList // labels associated to this address
          )
      )
      .toMap
    return new Program(
      name,
      base,
      instructions
    )
  }

  def loadInitialState(
      dut: MachineModeCoreTop,
      config: Config,
      frontend: TestFrontend
  ): InitialState = {
    return new InitialState(
      loadProgram(
        "OS",
        config.machine_program_file,
        config.initial_pc,
        config,
        frontend
      ),
      config.user_program_files
        .map[Program](x =>
          loadProgram(x._2._1, x._2._2, x._1, config, frontend)
        )
        .toList,
      Map((0 to 31).map(i => i -> BigInt(0)): _*),
      getCSRValues(dut),
      config.initial_memory + (config.mtime -> BigInt(10)) + (BigInt(
        0xfffff000L
      ) -> getImmatrikulationNumber()),
      config.initial_pc
    )
  }

  def clockStep(dut: MachineModeCoreTop, state: State, config: Config) = {
    dut.clock.step()
    if (
      (1L << 32) - state.getMemoryValue(config.mtime) <= 1 && (1L << 32) - state
        .getMemoryValue(config.mtimeh) <= 1
    ) {
      state.addMemoryUpdate(
        Map(
          config.mtime -> new ValueUpdate(
            state.getMemoryValue(config.mtime, false),
            0
          )
        )
      )
      state.addMemoryUpdate(
        Map(
          config.mtimeh -> new ValueUpdate(
            state.getMemoryValue(config.mtimeh, false),
            0
          )
        )
      )
    } else if ((1L << 32) - state.getMemoryValue(config.mtime) <= 1) {
      state.addMemoryUpdate(
        Map(
          config.mtime -> new ValueUpdate(
            state.getMemoryValue(config.mtime, false),
            0
          )
        )
      )
      state.addMemoryUpdate(
        Map(
          config.mtimeh -> new ValueUpdate(
            state.getMemoryValue(config.mtimeh, false),
            state.getMemoryValue(config.mtimeh, true) + 1
          )
        )
      )
    } else {
      state.addMemoryUpdate(
        Map(
          config.mtime -> new ValueUpdate(
            state.getMemoryValue(config.mtime, false),
            state.getMemoryValue(config.mtime, true) + 1
          )
        )
      )
    }
  }

  def processInterrupts(
      dut: MachineModeCoreTop,
      state: State,
      config: Config
  ) = {
    if (
      (state.getMemoryValue(config.mtime, true) >= state.getMemoryValue(
        config.mtimecmp,
        true
      ) && state.getMemoryValue(config.mtimeh, true) == state.getMemoryValue(
        config.mtimecmph,
        true
      )) || state.getMemoryValue(config.mtimeh, true) > state.getMemoryValue(
        config.mtimecmph,
        true
      )
    ) {
      dut.io_interrupt.m_timer.poke(true.B)
    } else {
      dut.io_interrupt.m_timer.poke(false.B)
    }
    dut.io_interrupt.m_ext.poke(false.B)
    var external_interrupt = false
    if (
      dut.io_data.data_req.peekBoolean() &&
      dut.io_data.data_we.peekBoolean() &&
      dut.io_data.data_addr.peek().litValue == config.terminal_data &&
      state.getMemoryValue(config.terminal_ready) == 1
    ) {
      state.addTerminalOutput(
        (dut.io_data.data_wdata.peek().litValue & 0xff).toChar
      )
      state.terminal_ready_timer = config.terminal_delay + 1
      state.addMemoryUpdate(
        Map(
          config.terminal_ready -> new ValueUpdate(
            state.getMemoryValue(config.terminal_ready),
            0
          )
        )
      )
    } else if (frontend.getTerminalReady().nonEmpty) {
      if (
        state.getMemoryValue(config.terminal_ready) == 0 &&
        frontend.getTerminalReady().get
      ) {
        // println("Terminal ready signal set by frontend.")
        external_interrupt = true
        state.addMemoryUpdate(
          Map(
            config.terminal_ready -> new ValueUpdate(
              state.getMemoryValue(config.terminal_ready),
              1
            )
          )
        )
      }
    } else if (state.terminal_ready_timer >= 1) {
      state.terminal_ready_timer -= 1
    } else if (state.terminal_ready_timer == 0) {
      // println("Terminal ready signal set by timer.")
      external_interrupt = true
      state.addMemoryUpdate(
        Map(
          config.terminal_ready -> new ValueUpdate(
            state.getMemoryValue(config.terminal_ready),
            1
          )
        )
      )
    }
    if (state.next_key._1) {
      // println(s"External interrupt from keyboard with key ${state.next_key._3}")
      external_interrupt = true
      state.next_key = (false, state.next_key._2, state.next_key._3)
    }
    if (external_interrupt) {
      dut.io_interrupt.m_ext.poke(true.B)
    } else {
      dut.io_interrupt.m_ext.poke(false.B)
    }
  }

  def assignInputs(dut: MachineModeCoreTop, state: State, config: Config) = {
    val include_pending = dut.io_data.data_addr.peek().litValue match {
      case config.keyboard_data | config.keyboard_ready => true
      case _                                            => false
    }
    // println(dut.io_instr.instr_req.peek())
    if (dut.io_instr.instr_req.peekBoolean()) {
      dut.io_instr.instr_rdata.poke(
        state.getInstruction(dut.io_instr.instr_addr.peek().litValue)
      )
      dut.io_instr.instr_gnt.poke(true.B)
    } else {
      dut.io_instr.instr_gnt.poke(false.B)
    }
    if (
      dut.io_data.data_req.peekBoolean() && !dut.io_data.data_we.peekBoolean()
    ) {
      val mask = dut.io_data.data_be.peek().litValue
      var data = 0L
      for (i <- 0 until 4) {
        if ((mask & (1 << i)) != 0) {
          val address = (dut.io_data.data_addr.peek().litValue + i) & 0xfffffffc
          val offset =
            ((dut.io_data.data_addr.peek().litValue + i) & 0x00000003).toInt
          data |= ((state
            .getMemoryValue(address)
            .toLong >> (offset * 8)) & 0xff) << (i * 8)
        }
      }
      dut.io_data.data_rdata.poke(data.U)
      dut.io_data.data_gnt.poke(true.B)
      if (dut.io_data.data_addr.peek().litValue == config.keyboard_data) {
        state.addMemoryUpdate(
          Map(
            config.keyboard_ready -> new ValueUpdate(
              state.getMemoryValue(config.keyboard_ready),
              0
            )
          )
        )
      }
    } else if (
      dut.io_data.data_req.peekBoolean() && dut.io_data.data_we
        .peekBoolean()
    ) {
      // Do nothing, inputs already assigned.

    } else {
      dut.io_data.data_gnt.poke(false.B)
    }
  }

  def computeMemoryUpdateHelper(
      address: BigInt,
      value: BigInt,
      mask_4bit: BigInt,
      getOldValue: BigInt => BigInt,
      addValueUpdate: (BigInt, ValueUpdate[BigInt]) => Unit
  ) = {
    // We are given the mask as a 4-bit value, but we need to convert it to a 32-bit mask where each byte is either 0xFF or 0x00 depending on the corresponding bit in the 4-bit mask
    val mask = (0 until 4)
      .map(i =>
        if ((mask_4bit & (1 << i)) != 0) BigInt(0xff) << (i * 8) else BigInt(0)
      )
      .foldLeft(BigInt(0))((a, b) => a | b)

    val offset =
      (address % 4).toInt // Calculate the offset of the address within the 4-byte word

    val firstMask = (mask << (offset * 8)) & 0xffffffffL
    val secondMask = (mask << (offset * 8)) >> 32

    // We need to add an update for the lower address if there is any overlap with the mask
    if (firstMask != 0) {
      val address_1 = address & 0xfffffffc
      val old_value_1 = getOldValue(address_1)
      // Shift the new value according to the offset and mask
      // For the first address, we need to shift the value to the left by offset * 8 and apply the mask
      val new_value_1 =
        (old_value_1 & ~(firstMask)) | ((value << (offset * 8)) & firstMask)
      addValueUpdate(address_1, new ValueUpdate(old_value_1, new_value_1))
    }
    // We also need to add an update for the higher address if there is any overlap with the mask
    if (secondMask != 0) {
      val address_2 = (address & 0xfffffffc) + 4
      val old_value_2 = getOldValue(address_2)
      // Shift the new value according to the offset and mask
      // For the second address, we need to shift the value to the right by (4 - offset) * 8 and apply the mask
      val new_value_2 =
        (old_value_2 & ~(secondMask)) | ((value >> ((4 - offset) * 8)) & secondMask)
      addValueUpdate(address_2, new ValueUpdate(old_value_2, new_value_2))
    }
  }

  def computeDisplayUpdate(
      address: BigInt,
      value: BigInt,
      mask_4bit: BigInt,
      getOldValue: BigInt => BigInt,
      addDisplayOutput: ((Int, Int), BigInt) => Unit,
      config: Config
  ) = {
    val mask = (0 until 4)
      .map(i => if ((mask_4bit & (1 << i)) != 0) 0xff << (i * 8) else 0)
      .foldLeft(0L)((a, b) => a | b)
    val offset =
      (address % 4).toInt // Calculate the offset of the address within the 4-byte word

    val firstMask = (mask << (offset * 8)) & 0xffffffffL
    val secondMask = (mask << (offset * 8)) >> 32

    if (address >= config.display && address < config.display + 32 * 32 * 4) {
      val x = (((address - config.display) % (32 * 4)) / 4).toInt
      val y = ((address - config.display) / (32 * 4)).toInt
      // We need to add an update for the lower pixel if there is any overlap with the mask
      if (firstMask != 0) {
        val address_1 = address & 0xfffffffc
        val old_value_1 = getOldValue(address_1)
        // Shift the new value according to the offset and mask
        // For the first address, we need to shift the value to the left by offset * 8 and apply the mask
        val new_value_1 =
          (old_value_1 & ~(firstMask)) | ((value << (offset * 8)) & firstMask)
        addDisplayOutput((x, y), new_value_1)
      }
      // We also need to add an update for the higher address if there is any overlap with the mask
      if (secondMask != 0) {
        val address_2 = (address & 0xfffffffc) + 4
        val old_value_2 = getOldValue(address_2)
        // Shift the new value according to the offset and mask
        // For the second address, we need to shift the value to the right by (4 - offset) * 8 and apply the mask
        val new_value_2 =
          (old_value_2 & ~(secondMask)) | ((value >> ((4 - offset) * 8)) & secondMask)
        addDisplayOutput((x, y + 1), new_value_2)
      }
    }
  }

  def computeMemoryUpdate(
      dut: MachineModeCoreTop,
      state: State,
      config: Config
  ) = {
    if (
      dut.io_data.data_req.peekBoolean() && dut.io_data.data_we.peekBoolean()
    ) {
      val address = dut.io_data.data_addr.peek().litValue
      val value = dut.io_data.data_wdata.peek().litValue.toLong
      val mask = dut.io_data.data_be.peek().litValue
      dut.io_data.data_gnt.poke(true.B)

      computeMemoryUpdateHelper(
        address,
        value,
        mask,
        addr => state.getMemoryValue(addr, false),
        (addr, update) => state.addMemoryUpdate(Map(addr -> update))
      )
      computeDisplayUpdate(
        address,
        value,
        mask,
        addr => state.getMemoryValue(addr, false),
        state.addDisplayOutput,
        config
      )
    }
  }

  def computeUpdate(dut: MachineModeCoreTop, state: State) = {
    val pc = ValueUpdate(
      dut.io_rvfi.rvfi_pc_rdata.peek().litValue,
      dut.io_rvfi.rvfi_pc_wdata.peek().litValue
    )
    val writeCount = dut.io_rvfi.rvfi_rd_wcount.peek().litValue.toInt
    val reg_updates = (0 until writeCount)
      .flatMap(i => {
        val reg_address = dut.io_rvfi.rvfi_rd_addr(i).peek().litValue.toInt
        if (reg_address == 0) {
          None
        } else {
          val reg_value = dut.io_rvfi.rvfi_rd_wdata(i).peek().litValue
          Some(
            reg_address -> new ValueUpdate(
              state.getRegisterValue(reg_address),
              reg_value
            )
          )
        }
      })
      .toMap

    state.addUpdate(
      new StateUpdate(
        state.next_index,
        pc,
        reg_updates,
        computeCSRUpdate(dut, state),
        Map(),
        new ValueUpdate(state.getTerminalOutput(), state.getTerminalOutput()),
        Map()
      )
    )
  }

  def computeCSRUpdate(
      dut: MachineModeCoreTop,
      state: State
  ): Map[BigInt, ValueUpdate[BigInt]] = {
    return CSR_MAPPING.all
      .map(csr => {
        val old_value = state.getCSRValue(csr.litValue)
        val new_value = dut
          .csr_rvfi(csr)
          .wdata
          .peek()
          .litValue & dut.csr_rvfi(csr).wmask.peek().litValue
        if (old_value != new_value) {
          val csr_name = csr.litValue
          val csr_update = new ValueUpdate(old_value, new_value)
          csr_name -> Option(csr_update)
        } else {
          csr.litValue -> Option.empty
        }
      })
      .filter(o => !(o._2.isEmpty))
      .map(o => o._1 -> o._2.get)
      .toMap
  }

  def getCSRValues(dut: MachineModeCoreTop): Map[BigInt, BigInt] = {
    return CSR_MAPPING.all
      .map(csr => {
        val new_value = dut
          .csr_rvfi(csr)
          .wdata
          .peek()
          .litValue & dut.csr_rvfi(csr).wmask.peek().litValue
        csr.litValue -> new_value
      })
      .toMap
  }

  def queryKeyboard(
      dut: MachineModeCoreTop,
      state: State,
      config: Config,
      frontend: TestFrontend
  ) = {
    val (index, key) = frontend.getKey()
    var has_changed = false
    if (state.next_key._2 < index) {
      has_changed = true
      state.addMemoryUpdate(
        Map(
          config.keyboard_data -> new ValueUpdate(
            state.getMemoryValue(config.keyboard_data),
            key.toInt
          ),
          config.keyboard_ready -> new ValueUpdate(
            state.getMemoryValue(config.keyboard_ready),
            1
          )
        )
      )
    }
    state.next_key = (has_changed, index, key)
  }

  def resetCore(
      dut: MachineModeCoreTop,
      config: Config,
      frontend: TestFrontend
  ): State = {
    println("Resetting the core.")
    // Reset the core
    dut.io_reset.boot_addr.poke(config.initial_pc.U)
    dut.io_reset.rst_n.poke(false.B)
    dut.io_instr.instr_gnt.poke(false.B)
    dut.io_data.data_gnt.poke(false.B)
    dut.clock.step()
    dut.io_reset.rst_n.poke(true.B)
    dut.clock.step()
    val initialState = loadInitialState(dut, config, frontend)
    var state = new State(initialState, List())
    state.terminal_ready_timer = config.terminal_delay + 1
    // state.addMemoryUpdate(Map(config.keyboard_ready -> new ValueUpdate(state.getMemoryValue(config.keyboard_ready), 0), config.terminal_ready -> new ValueUpdate(state.getMemoryValue(config.terminal_ready), 1)))
    println(
      "Starting simulation for " + getCategory() + " - (remaining: " + frontends.size + ")"
    )
    frontend.publishInitialState(initialState)
    return state
  }

  def resetCoreLive(
      dut: MachineModeCoreTop,
      config: Config,
      state: State,
      frontend: TestFrontend,
      reset_addr: BigInt
  ): State = {
    println("Resetting the core.")
    // Reset the core
    dut.io_reset.boot_addr.poke(reset_addr.U)
    dut.io_reset.rst_n.poke(false.B)
    dut.io_instr.instr_gnt.poke(false.B)
    dut.io_data.data_gnt.poke(false.B)
    dut.clock.step()
    dut.io_reset.rst_n.poke(true.B)
    dut.clock.step()
    val stateUpdate = new StateUpdate(
      state.next_index,
      new ValueUpdate(state.getPCValue(), reset_addr),
      (0 to 31)
        .map(i => i -> new ValueUpdate(state.getRegisterValue(i), BigInt(0)))
        .toMap,
      computeCSRUpdate(dut, state),
      Map(
        config.mtime -> new ValueUpdate(
          state.getMemoryValue(config.mtime, false),
          BigInt(0)
        )
      ) ++ Map(
        config.mtimeh -> new ValueUpdate(
          state.getMemoryValue(config.mtimeh, false),
          BigInt(0)
        )
      ) ++ Map(
        config.mtimecmp -> new ValueUpdate(
          state.getMemoryValue(config.mtimecmp, false),
          BigInt(0)
        )
      ) ++ Map(
        config.mtimecmph -> new ValueUpdate(
          state.getMemoryValue(config.mtimecmph, false),
          BigInt(0)
        )
      ) ++ Map(
        config.keyboard_ready -> new ValueUpdate(
          state.getMemoryValue(config.keyboard_ready),
          BigInt(0)
        )
      ) ++ Map(
        config.terminal_ready -> new ValueUpdate(
          state.getMemoryValue(config.terminal_ready),
          BigInt(1)
        )
      ),
      new ValueUpdate(state.getTerminalOutput(), ""),
      (0 until 32)
        .flatMap(i => {
          val address = config.display + (i * 32 * 4)
          (0 until 32).map(j => {
            val addr = address + (j * 4)
            (i, j) -> new ValueUpdate(
              state.getDisplayValue((i, j)),
              BigInt(0)
            )
          })
        })
        .toMap
    )
    state.addUpdate(stateUpdate)
    val resetUpdate = state.flushUpdate()
    if (!resetUpdate.isEmpty) {
      frontend.publishUpdate(resetUpdate.get)
    }
    state
  }

  def hasSimulateResetLabelAt(state: State, address: BigInt): Boolean = {
    val programs =
      state.initialState.machine_program +: state.initialState.user_programs
    programs.exists(program =>
      program.instructions.get(address).exists { case (_, _, labels) =>
        labels.contains("_suspend") || labels.contains("_reset")
      }
    )
  }

  def step(
      dut: MachineModeCoreTop,
      state: State,
      config: Config,
      frontend: TestFrontend
  ) = {
    var was_valid = false
    while (!was_valid) {
      queryKeyboard(dut, state, config, frontend)
      assignInputs(dut, state, config)
      clockStep(dut, state, config)
      processInterrupts(dut, state, config)
      computeMemoryUpdate(dut, state, config)
      if (dut.io_rvfi.rvfi_valid.peekBoolean()) {
        computeUpdate(dut, state)
        val update = state.flushUpdate()
        if (!update.isEmpty) {
          frontend.publishUpdate(update.get)
          was_valid = true
          val newPC = update.get.pc.newValue
          if (hasSimulateResetLabelAt(state, newPC)) {
            resetCoreLive(dut, config, state, frontend, newPC)
            state.setSuspended(true)
            frontend.setSuspended(true)
          }
        }
      }
    }
  }

  // def runSimulation(frontend: TestFrontend, mayExit: Boolean) = {
  s"${getCategory()}" should s"${getName()}" in {

    var exitting = false
    simulate(new MachineModeCoreTop()) { dut =>
      // enableWaves()
      // dut.clock.setTimeout(0) TODO: figure out how ChiselSim handles timeouts
      while (!exitting) {
        var error = false
        var config: Config = null
        var state: State = null
        // get configuration
        try {
          while (config == null) {
            Thread.sleep(100)
            config = frontend.getConfig()
          }
          state = resetCore(dut, config, frontend)
        } catch {
          case e: Exception =>
            {
              frontend.publishError(
                e.getMessage() + "\n Please upload a new configuration file once the error is resolved."
              )
              println(e.getMessage())
              error = true
            }
            if (frontend.mayExit()) {
              if (frontends.size > 0) {
                frontend = frontends.dequeue()
              } else {
                exitting = true
              }
            } else {
              while (frontend.getAction().action != "INITIALIZE") {
                Thread.sleep(100)
              }
            }
        }
        while (!error) {
          var nop_counter = 0
          try {
            var action = frontend.getAction()
            if (action.action != "NOP") {
              // println(action)
              nop_counter = 0
            }
            if (state.isSuspended) {
              if (action.action == "RESUME") {
                state.setSuspended(false)
                frontend.setSuspended(false)
                action = UIAction("STEP", 0, 1)
              } else if (action.action == "STEP" || action.action == "RUN") {
                action = UIAction("NOP", 0, 0)
              }
            }
            action.action match {
              case "NOP" => {
                nop_counter += 1
                if (nop_counter > 100) {
                  frontend.publishCurrentState(state)
                  nop_counter = 0
                } else {
                  Thread.sleep(100) // Sleep for 100ms
                }
              }
              case "STEP" => {
                step(dut, state, config, frontend)
              }
              case "RESTART" => {
                state = resetCore(dut, config, frontend)
                state.setSuspended(false)
                frontend.setSuspended(false)
              }
              case "RUN" => {
                var i = 0
                var stop = false
                while (i < action.cycles && !stop) {
                  step(dut, state, config, frontend)
                  i += 1
                  if (action.delay > 0) {
                    Thread.sleep(action.delay)
                  }
                  if ((i % 10 == 0) && frontend.getAction().action != "NOP") {
                    stop = true
                  }
                  if (state.isSuspended) {
                    stop = true
                  }
                }
              }
              case "INITIALIZE" => {
                error = true
              }
              case "EXIT" => {
                error = true
                if (frontend.mayExit()) {
                  if (frontends.size > 0) {
                    frontend = frontends.dequeue()
                  } else {
                    exitting = true
                  }
                } else {
                  frontend.publishError("Cannot exit from this test.")
                }
              }
              case _ => {
                frontend.publishError("Invalid action: " + action.action)
                error = true
              }
            }
          } catch {
            case e: Exception => {
              frontend.publishError(
                e.getMessage() + "\n Please restart the simulation once the error is resolved."
              )
              println(e.getMessage())
              error = true
            }
          }
        }
      }
    }
  }
  // }
}

class InteractiveTester()
    extends AnyFlatSpec
    with ChiselSim
    with Matchers
    with TesterBase {}
