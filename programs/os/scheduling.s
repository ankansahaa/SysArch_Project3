_start: 
    # TODO: setup exception handler
    li t0, 0x8800
    csrw mscratch, t0

    la t0, exception_handler
    csrw mtvec, t0

    li t0, 0x8000
    sw zero, 0(t0)
    sw zero, 4(t0)
    li t0, 0x8100
    li t1, 9

    clear_pcb_loop:
    sw zero, 0(t0)
    addi t0, t0, 160
    addi t1, t1, -1
    bnez t1, clear_pcb_loop

    li t0, 0x8100
    li t1, 1
    sw t1, 0(t0)          # startup active
    la t2, startup
    sw t2, 4(t0)          # startup pc
    sw zero, 8(t0)        # no estimate
    sw t1, 12(t0)         # is startup

    la t1, mtime
    lw t2, 0(t1)
    li t0, 0x8000
    sw t2, 8(t0) 


    # TODO: setup mepc to point to the first instruction of the startup process
    la t0, startup
    csrw mepc, t0

    # TODO: enable and setup interrupts as needed
    # TODO: jump to user mode
    li t0, 0x1800
    csrrc zero, mstatus, t0

    mret

exception_handler:
    # TODO: save some registers
    csrrw t0, mscratch, t0
    sw t1, 0(t0)
    sw t2, 4(t0)
    sw t3, 8(t0)
    sw t4, 12(t0)
    sw t5, 16(t0)
    sw t6, 20(t0)

    li t1, 0x8000
    lw t1, 0(t1)

    li t2, 160
    mul t1, t1, t2

    li t2, 0x8100
    add t2, t2, t1

    sw ra, 16(t2)
    sw sp, 20(t2)
    sw gp, 24(t2)
    sw tp, 28(t2)

    csrr t1, mscratch
    sw t1, 32(t2)

    lw t1, 0(t0)
    sw t1, 36(t2)

    lw t1, 4(t0)
    sw t1, 40(t2)

    sw s0, 44(t2)
    sw s1, 48(t2)
    sw a0, 52(t2)
    sw a1, 56(t2)
    sw a2, 60(t2)
    sw a3, 64(t2)
    sw a4, 68(t2)
    sw a5, 72(t2)
    sw a6, 76(t2)
    sw a7, 80(t2)
    sw s2, 84(t2)
    sw s3, 88(t2)
    sw s4, 92(t2)
    sw s5, 96(t2)
    sw s6, 100(t2)
    sw s7, 104(t2)
    sw s8, 108(t2)
    sw s9, 112(t2)
    sw s10, 116(t2)
    sw s11, 120(t2)

    lw t1, 8(t0)
    sw t1, 124(t2)

    lw t1, 12(t0)
    sw t1, 128(t2)

    lw t1, 16(t0)
    sw t1, 132(t2)

    lw t1, 20(t0)
    sw t1, 136(t2)

    csrr t1, mepc
    addi t1, t1, 4
    sw t1, 4(t2)

    # TODO: update estimated time to completion of current process
    lw t1, 12(t2)
    bnez t1, skip_time_update

    lw t1, 0(t2)
    beqz t1, skip_time_update

    la t3, mtime
    lw t3, 0(t3)

    li t4, 0x8000
    lw t5, 8(t4)

    sub t3, t3, t5

    lw t5, 8(t2)
    sub t5, t5, t3
    sw t5, 8(t2)
    # TODO: handle the exception
    skip_time_update:
        csrr t1, mcause
        li t3, 8
        bne t1, t3, unsupported_call

        lw t1, 80(t2)
        li t3, 0x0A000000
        bne t1, t3, unsupported_call

        lw t1, 76(t2)

        beqz t1, create_process

        li t3, 1
        beq t1, t3, kill_process
    unsupported_call:
        li t1 -2
        sw t1 52(t2)

    # TODO: schedule next process
        j  schedule_next

create_process:
    # TODO: assign new process ID (if less than 8 non-startup processes exist)
    li t4, 0x8000
    lw t5, 4(t4)
    li t6, 8
    bge t5, t6, create_process_fail

    li t3, 1
    li t4, 0x8100
    addi t4, t4, 160
find_free_process:
    lw t5, 0(t4)
    beqz t5, free_process_found

    addi t3, t3, 1
    addi t4, t4, 160

    li t6, 9
    blt t3, t6, find_free_process

    j create_process_fail
    # TODO: set up new process control block 
free_process_found:
    addi t5, t2, 16
    addi t6, t4, 16
    li t1, 31
    # TODO: continue with the right process at the right address
copy_parent_registers:
    lw t0, 0(t5)
    sw t0, 0(t6)

    addi t5, t5, 4
    addi t6, t6, 4
    addi t1, t1, -1

    bnez t1, copy_parent_registers

    li t1, 1
    sw t1, 0(t4)

    lw t1, 52(t2)
    sw t1, 4(t4)

    lw t1, 56(t2)
    sw t1, 8(t4)

    sw zero, 12(t4)

    sw zero, 52(t2)

    li t1, 0x8000
    lw t5, 4(t1)
    addi t5, t5, 1
    sw t5, 4(t1)

    j schedule_next

create_process_fail:
    li t1, -1
    sw t1, 52(t2)
    j schedule_next

kill_process:
    # TODO: remove the current process from the sacheduler
    sw zero, 0(t2)

    lw t1, 12(t2)
    bnez t1, schedule_next

    li t3, 0x8000
    lw t4, 4(t3)
    addi t4, t4, -1
    sw t4, 4(t3)

    j schedule_next
schedule_next:
    li t2, 0x8100
    lw t1, 0(t2)
    bnez t1, choose_startup_process

    li t3, -1
    li t4, 0x7fffffff

    li t5, 1
    li t6, 0x8100
    addi t6, t6, 160

schedule_scan_loop:
    lw t1, 0(t6)
    beqz t1, schedule_scan_continue

    lw t1, 8(t6)
    blt t1, t4, schedule_update_best

    j schedule_scan_continue

schedule_update_best:
    mv t4, t1
    mv t3, t5

schedule_scan_continue:
    addi t5, t5, 1
    addi t6, t6, 160

    li t0, 9
    blt t5, t0, schedule_scan_loop

    li t0, -1
    beq t3, t0, shutdown

    li t0, 160
    mul t1, t3, t0

    li t2, 0x8100
    add t2, t2, t1

    j dispatch_process

choose_startup_process:
    li t3, 0
    li t2, 0x8100
    j dispatch_process


dispatch_process:
    li t0, 0x8000
    sw t3, 0(t0)

    lw t1, 4(t2)
    csrw mepc, t1

    la t1, mtime
    lw t1, 0(t1)
    sw t1, 8(t0)

    lw t1, 32(t2)
    csrw mscratch, t1

    lw ra, 16(t2)
    lw sp, 20(t2)
    lw gp, 24(t2)
    lw tp, 28(t2)

    lw t1, 36(t2)

    lw s0, 44(t2)
    lw s1, 48(t2)
    lw a0, 52(t2)
    lw a1, 56(t2)
    lw a2, 60(t2)
    lw a3, 64(t2)
    lw a4, 68(t2)
    lw a5, 72(t2)
    lw a6, 76(t2)
    lw a7, 80(t2)
    lw s2, 84(t2)
    lw s3, 88(t2)
    lw s4, 92(t2)
    lw s5, 96(t2)
    lw s6, 100(t2)
    lw s7, 104(t2)
    lw s8, 108(t2)
    lw s9, 112(t2)
    lw s10, 116(t2)
    lw s11, 120(t2)
    lw t3, 124(t2)
    lw t4, 128(t2)
    lw t5, 132(t2)
    lw t6, 136(t2)

    lw t2, 40(t2)

    li t0, 0x8800
    csrrw t0, mscratch, t0

    mret


# ----------------------------------------------------------------------
# Simulated shutdown. Do not touch this part.
# ----------------------------------------------------------------------
shutdown:
    j shutdown # infinite loop