_start:
    # 1. Point mtvec to our exception handler
    la t0, exception_handler
    csrw mtvec, t0

    # 2. Point mepc to the user program entry point
    la t0, user_systemcalls
    csrw mepc, t0

    # 3. Enable Machine-mode External Interrupts (set MIE bit 11 in mie CSR)
    li t0, 0x800
    csrw mie, t0

    # 4. Enable Global Interrupts (set MIE bit 3 in mstatus)
    li t0, 0x8
    csrs mstatus, t0

    # 5. Setup character buffer pointers at a safe hardcoded RAM location (0x3FFE00)
    # Head pointer at 0x3FFE00, Tail pointer at 0x3FFE04, Buffer starts at 0x3FFE08
    li t0, 0x3FFE00
    sw zero, 0(t0)      # Head index = 0
    sw zero, 4(t0)      # Tail index = 0

    # 6. Switch privilege mode to User Mode (clear MPP bits in mstatus)
    li t0, 0x1800
    csrc mstatus, t0

    # 7. Jump to user mode!
    mret

# =====================================================================
# TRAP HANDLER DISPATCHER
# =====================================================================
exception_handler:
    # Save temporary scratchpad registers on the stack
    addi sp, sp, -24
    sw t0, 0(sp)
    sw t1, 4(sp)
    sw t2, 8(sp)
    sw t3, 12(sp)
    sw a7, 16(sp)
    sw a6, 20(sp)

    # Determine if this trap was caused by an Interrupt or an Exception
    csrr t0, mcause
    bltz t0, handle_interrupt   # If top bit is 1, it's an interrupt!

    # Verify this is an environment call from User Mode (mcause == 8)
    li t1, 8
    bne t0, t1, restore_and_exit

    # Check Extension ID (a7 == 0x4442434E)
    li t0, 0x4442434E
    bne a7, t0, invalid_call

    # Check Function ID (a6)
    li t0, 4
    beq a6, t0, handle_write_string   # FID = 4 -> Print String
    li t0, 5
    beq a6, t0, handle_write_number   # FID = 5 -> Print Number

invalid_call:
    li a0, -1                        
    j end_trap

# =====================================================================
# SUBROUTINES
# =====================================================================

handle_write_string:
    mv t0, a0                       # t0 = source string pointer
    li t2, 0x3FFE00                 # Buffer management base address
    lw t3, 4(t2)                    # t3 = Current Tail Index

load_to_buffer_loop:
    lbu t1, 0(t0)                   # Read character
    beqz t1, kickstart_transmission # If null terminator, we are done buffering

    # Store character into RAM buffer at location [0x3FFE08 + Tail]
    addi t4, t3, 0x3FFE08
    sb t1, 0(t4)
    
    addi t3, t3, 1                  # Increment tail pointer
    addi t0, t0, 1                  # Move to next string char
    j load_to_buffer_loop

kickstart_transmission:
    sw t3, 4(t2)                    # Save updated Tail Index back to memory
    lw t1, 0(t2)                    # Read current Head Index
    
    # If Head == Tail, buffer was empty (nothing to print)
    beq t1, t3, print_str_done

    # Kickstart transmission by printing the VERY FIRST character manually
    addi t4, t1, 0x3FFE08
    lbu t0, 0(t4)
    la t4, terminal_data
    sw t0, 0(t4)                    # Write first byte to console UART hardware

    # Advance head index by 1 since we just sent the first character
    addi t1, t1, 1
    sw t1, 0(t2)

print_str_done:
    li a0, 0                        
    j end_trap

handle_write_number:
    # Handle base case zero
    bnez a0, num_setup
    li t1, 48
    la t2, terminal_data
    sw t1, 0(t2)
    li a0, 0
    j end_trap

num_setup:
    li t1, 10
    li t4, 0                        # Stack digit tracking counter

num_extract_loop:
    remu t2, a0, t1                 
    addi t2, t2, 48                 # Shift to ASCII
    addi sp, sp, -4
    sw t2, 0(sp)                    # Push to stack
    divu a0, a0, t1                 
    addi t4, t4, 1                  
    bnez a0, num_extract_loop       

    # Since numbers are small and written instantly, write directly to hardware
print_num_loop:
    lw t1, 0(sp)                    
    addi sp, sp, 4
wait_num_hardware:
    la t2, terminal_ready
    lw t3, 0(t2)
    andi t3, t3, 1
    beqz t3, wait_num_hardware
    la t2, terminal_data
    sw t1, 0(t2)
    addi t4, t4, -1
    bnez t4, print_num_loop

    li a0, 0
    j end_trap

# =====================================================================
# HARDWARE INTERRUPT HANDLING
# =====================================================================
handle_interrupt:
    # Check if this was a terminal TX interrupt
    # Ordinarily determined by looking at the mcause value or checking terminal status
    li t2, 0x3FFE00                 # Buffer tracking metrics address
    lw t0, 0(t2)                    # t0 = Head Index
    lw t1, 4(t2)                    # t1 = Tail Index

    beq t0, t1, clear_interrupt_exit # If Head == Tail, buffer is completely clear!

    # Fetch next scheduled char out of buffer pool
    addi t3, t0, 0x3FFE08
    lbu t4, 0(t3)

    # Fire character straight into terminal hardware output registers
    la t3, terminal_data
    sw t4, 0(t3)

    # Increment and save head tracking metrics index pointers
    addi t0, t0, 1
    sw t0, 0(t2)

clear_interrupt_exit:
    # Clean up interrupt pending signals if your custom simulator interface mandates it
    j restore_and_exit

# =====================================================================
# TRAP CONTROL WRAPPERS
# =====================================================================
end_trap:
    csrr t0, mepc
    addi t0, t0, 4
    csrw mepc, t0

restore_and_exit:
    lw t0, 0(sp)
    lw t1, 4(sp)
    lw t2, 8(sp)
    lw t3, 12(sp)
    lw a7, 16(sp)
    lw a6, 20(sp)
    addi sp, sp, 24
    mret