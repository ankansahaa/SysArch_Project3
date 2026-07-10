# bootup
_start:
 # TODO: setup exception handler
 li t0, 0x7100
 csrw mscratch, t0

 la t0, exception_handler
 csrw mtvec, t0

 # current process id: 0 = fibonacci, 1 = factorial
 li t0, 0x7000
 sw zero, 0(t0)

 # clear both PCBs
 # PCB0 at 0x8000, PCB1 at 0x8100
 # layout:
 #   0   saved pc
 #   4   x1
 #   8   x2
 #   ...
 #   124 x31
 li t0, 0x8000
 li t1, 80

clear_pcb_loop:
 sw zero, 0(t0)
 addi t0, t0, 4
 addi t1, t1, -1
 bnez t1, clear_pcb_loop

 # setup PCB0 pc = fibonacci
 li t0, 0x8000
 la t1, fibonacci
 sw t1, 0(t0)

 # setup PCB1 pc = factorial
 li t0, 0x8100
 la t1, factorial
 sw t1, 0(t0)

 # TODO: setup mepc to point to the first instruction of the startup process
 la t0, fibonacci
 csrw mepc, t0

 # TODO: enable and setup interrupts as needed
 jal ra, set_next_timer

 # enable machine timer interrupt: mie.MTIE = bit 7
 li t0, 0x80
 csrrs zero, mie, t0

 # set MPIE so after mret, interrupts are enabled in user mode
 li t0, 0x80
 csrrs zero, mstatus, t0

 # clear MPP bits, so mret goes to user mode
 li t0, 0x1800
 csrrc zero, mstatus, t0

 # TODO: jump to user mode
 mret


exception_handler:
 # TODO: react to timer interrupt
 # swap user t0 with scratch pointer
 csrrw t0, mscratch, t0

 # save temporary registers first
 sw t1, 0(t0)
 sw t2, 4(t0)
 sw t3, 8(t0)
 sw t4, 12(t0)
 sw t5, 16(t0)
 sw t6, 20(t0)

 # get current pid
 li t1, 0x7000
 lw t1, 0(t1)

 # get current PCB base
 li t2, 0x8000
 beqz t1, current_pcb_ready
 li t2, 0x8100

current_pcb_ready:
 # save current pc
 csrr t3, mepc
 sw t3, 0(t2)

 # save all registers into current PCB
 sw ra, 4(t2)
 sw sp, 8(t2)
 sw gp, 12(t2)
 sw tp, 16(t2)

 # save original user t0 from mscratch
 csrr t3, mscratch
 sw t3, 20(t2)

 # save original t1-t6 from scratch memory
 lw t3, 0(t0)
 sw t3, 24(t2)

 lw t3, 4(t0)
 sw t3, 28(t2)

 sw s0, 32(t2)
 sw s1, 36(t2)
 sw a0, 40(t2)
 sw a1, 44(t2)
 sw a2, 48(t2)
 sw a3, 52(t2)
 sw a4, 56(t2)
 sw a5, 60(t2)
 sw a6, 64(t2)
 sw a7, 68(t2)
 sw s2, 72(t2)
 sw s3, 76(t2)
 sw s4, 80(t2)
 sw s5, 84(t2)
 sw s6, 88(t2)
 sw s7, 92(t2)
 sw s8, 96(t2)
 sw s9, 100(t2)
 sw s10, 104(t2)
 sw s11, 108(t2)

 lw t3, 8(t0)
 sw t3, 112(t2)

 lw t3, 12(t0)
 sw t3, 116(t2)

 lw t3, 16(t0)
 sw t3, 120(t2)

 lw t3, 20(t0)
 sw t3, 124(t2)

 # only react to machine timer interrupt: mcause = 0x80000007
 csrr t3, mcause
 li t4, 0x80000007
 bne t3, t4, dispatch_process

 # TODO: switch processes
 # current pid = current pid xor 1
 li t0, 0x7000
 lw t1, 0(t0)
 xori t1, t1, 1
 sw t1, 0(t0)

 # select next PCB
 li t2, 0x8000
 beqz t1, next_pcb_ready
 li t2, 0x8100

 # TODO: schedule next interrupt
next_pcb_ready:
    jal ra, set_next_timer

    li t0, 0x7000
    lw t1, 0(t0)

    li t2, 0x8000
    beqz t1, dispatch_process

    li t2, 0x8100
    j dispatch_process


set_next_timer:
 # next interrupt = mtime + 300
 la t0, mtime
 lw t1, 0(t0)
 lw t2, 4(t0)

 li t3, 300
 add t4, t1, t3

 # handle low-word overflow
 bltu t4, t1, timer_carry
 j timer_no_carry

timer_carry:
 addi t2, t2, 1

timer_no_carry:
 # safely write 64-bit mtimecmp
 li t5, -1
 la t0, mtimecmp
 sw t5, 0(t0)
 sw t2, 4(t0)
 sw t4, 0(t0)

 ret


dispatch_process:
 # load pc of selected process
 lw t1, 0(t2)
 csrw mepc, t1

 # put selected process's t0 into mscratch
 lw t1, 20(t2)
 csrw mscratch, t1

 # restore all registers except t0 and t2 last
 lw ra, 4(t2)
 lw sp, 8(t2)
 lw gp, 12(t2)
 lw tp, 16(t2)

 lw t1, 24(t2)

 lw s0, 32(t2)
 lw s1, 36(t2)
 lw a0, 40(t2)
 lw a1, 44(t2)
 lw a2, 48(t2)
 lw a3, 52(t2)
 lw a4, 56(t2)
 lw a5, 60(t2)
 lw a6, 64(t2)
 lw a7, 68(t2)
 lw s2, 72(t2)
 lw s3, 76(t2)
 lw s4, 80(t2)
 lw s5, 84(t2)
 lw s6, 88(t2)
 lw s7, 92(t2)
 lw s8, 96(t2)
 lw s9, 100(t2)
 lw s10, 104(t2)
 lw s11, 108(t2)
 lw t3, 112(t2)
 lw t4, 116(t2)
 lw t5, 120(t2)
 lw t6, 124(t2)

 # restore user t2
 lw t2, 28(t2)

 # restore user t0 and put scratch base back into mscratch
 li t0, 0x7100
 csrrw t0, mscratch, t0

 mret