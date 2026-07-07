package RISCV.interfaces.machine_mode

import chisel3._

import RISCV.interfaces.generic._
import RISCV.model.PRIV_LEVEL
import RISCV.model.CSR_MAPPING
import RISCV.model.STALL_REASON
import scala.collection.immutable.SortedMap
import RISCV.model.InstructionSets

trait MachineModeIO extends Module {
  implicit val csrMappingTypeOrdering: Ordering[CSR_MAPPING.Type] =
    Ordering.by(csr => csr.litValue)
  val csr_rvfi: SortedMap[CSR_MAPPING.Type, CSR_RVFI] = SortedMap(
    CSR_MAPPING.all
      .sortBy(csr => csr.litValue)
      .map(x => x -> IO(new CSR_RVFI)): _*
  )
  val io_interrupt = IO(new InterruptInterface)
}

abstract class AbstractMachineModeUnit
    extends AbstractExecutionUnit
    with MachineModeIO {
  val misa = IO(Input(UInt(32.W)))
  val trap = IO(Flipped(new TrapInterface))
  val trap_pc = IO(Output(UInt(32.W)))
  val io_priv_level = IO(Output(PRIV_LEVEL()))
  val io_retire = IO(Input(Bool()))
  val io_has_interrupt = IO(Output(Bool()))
  val io_stalled = IO(Input(STALL_REASON()))
}

abstract class AbstractCSR extends Module {
  val io_reset = IO(new ResetInterface)
  val io = IO(new CSRIO)
  io.next_r_value := io.r_data
}
