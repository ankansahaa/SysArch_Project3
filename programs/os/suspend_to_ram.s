_start:
    # 1. Point CPU to our Trap Vector
    la t0, exception_handler
    csrw mtvec, t0

    # 2. Point mepc to the Task 2 User Program
    la t0, user_suspend_to_ram
    csrw mepc, t0

    # 3. Drop down to User Mode (clear MPP bits in mstatus)
    li t0, 0x1800
    csrc mstatus, t0

    # 4. Blast off!
    mret

# =====================================================================
# TRAP HANDLER DISPATCHER
# =====================================================================
exception_handler:
    # Save user space temporary registers so they don't get corrupted
    addi sp, sp, -24
    sw t0, 0(sp)
    sw t1, 4(sp)
    sw t2, 8(sp)
    sw t3, 12(sp)
    sw a7, 16(sp)
    sw a6, 20(sp)

    # Verify Environment Call from User Mode (mcause == 8)
    csrr t0, mcause
    li t1, 8
    bne t0, t1, restore_and_exit

    # --- ROUTING BLOCK ---

    # Route 1: Console Management (EID = 0x4442434E)
    li t0, 0x4442434E
    beq a7, t0, handle_console_route

    # Route 2: Time Telemetry (EID = 0x54494D45)
    li t0, 0x54494D45
    beq a7, t0, handle_time_route

    # Route 3: Suspend to RAM (EID = 0x53555350)
    li t0, 0x53555350
    beq a7, t0, handle_suspend_route

invalid_call:
    li a0, -1
    j end_trap

# =====================================================================
# CONSOLE HANDLING (The Bug Fixers!)
# =====================================================================
handle_console_route:
    li t0, 2
    beq a6, t0, handle_console_write
    li t0, 3
    beq a6, t0, handle_console_read
    j invalid_call

handle_console_read:
wait_keyboard:
    la t2, keyboard_ready
    lw t3, 0(t2)
    andi t3, t3, 1                  # Check if data bit is ready
    beqz t3, wait_keyboard          # Loop until keypress arrives

    la t2, keyboard_data
    lw a1, 0(t2)                    # SUCCESS: Pass key character back to user in a1!
    j end_trap

handle_console_write:
wait_terminal:
    la t2, terminal_ready
    lw t3, 0(t2)
    andi t3, t3, 1                  # Check if TX hardware is free
    beqz t3, wait_terminal

    la t2, terminal_data
    sw a0, 0(t2)                    # Spit character onto the terminal screen
    j end_trap

# =====================================================================
# TELEMETRY & SUSPEND HANDLING
# =====================================================================
handle_time_route:
    li t0, 1
    bne a6, t0, invalid_call

    csrr t0, mcycle
    csrr t1, mcycleh
    csrr t2, minstret
    csrr t3, instreth
    csrr t4, time
    csrr t5, timeh

    sw t4, 0(a1)                    # mtimeL
    sw t5, 4(a1)                    # mtimeH
    sw t0, 8(a1)                    # mcycleL
    sw t1, 12(a1)                   # mcycleH
    sw t2, 16(a1)                   # minstretL
    sw t3, 20(a1)                   # minstretH
    j end_trap

handle_suspend_route:
    li t0, 0
    bne a6, t0, invalid_call

    # Suspend Magic: Change mepc to point directly to the resume address in a1
    csrw mepc, a1
    
    # Simulate suspension power down by bumping up time/cycle state
    csrr t0, mcycle
    addi t0, t0, 500                # Artificially fast-forward cycles
    csrw mcycle, t0
    
    j restore_and_exit              # Skip normal end_trap PC+4 step!

# =====================================================================
# SYSTEM CALL EXIT WRAPPERS
# =====================================================================
end_trap:
    # Advance mepc by 4 so we don't repeat the ecall instruction
    csrr t0, mepc
    addi t0, t0, 4
    csrw mepc, t0

restore_and_exit:
    # Restore temporary registers cleanly
    lw t0, 0(sp)
    lw t1, 4(sp)
    lw t2, 8(sp)
    lw t3, 12(sp)
    lw a7, 16(sp)
    lw a6, 20(sp)
    addi sp, sp, 24
    mret