_start:
    # 1. Point the CPU to our Exception Bouncer
    la t0, exception_handler
    csrw mtvec, t0

    # 2. Point to the first user program (startup)
    la t0, user_systemcalls
    csrw mepc, t0

    # 3. Switch privilege mode to User Mode (clear MPP bits in mstatus)
    li t0, 0x1800
    csrc mstatus, t0

    # 4. Blast off into user land!
    mret

# =====================================================================
# TRAP HANDLER DISPATCHER
# =====================================================================
exception_handler:
    # Save temporary registers on the stack so user space doesn't get corrupted
    addi sp, sp, -24
    sw t0, 0(sp)
    sw t1, 4(sp)
    sw t2, 8(sp)
    sw t3, 12(sp)
    sw a7, 16(sp)
    sw a6, 20(sp)

    # Verify this is an environment call from User Mode (mcause == 8)
    csrr t0, mcause
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
    li a0, -2                        # Return error code for unsupported functions
    j end_trap

# =====================================================================
# SUBROUTINES (Task 1.1 & 1.2)
# =====================================================================

handle_write_string:
    mv t0, a0                       # Move string pointer from a0 to t0 so we don't lose it

print_loop:
    lbu t1, 0(t0)                   # Load one single byte (char) from the string
    beqz t1, print_success          # If the char is '\0', string is over!

wait_terminal_str:
    la t2, terminal_ready           # Check hardware status
    lw t3, 0(t2)
    andi t3, t3, 1                  # Check bit 0 (TX Ready flag)
    beqz t3, wait_terminal_str      # Busy-wait loop if hardware is clogged

    la t2, terminal_data            # Use terminal_data (the winner from Task 2!)
    sw t1, 0(t2)                    # Send character to the terminal screen

    addi t0, t0, 1                  # Move pointer 1 byte forward to next character
    j print_loop

print_success:
    li a0, 0                        # Return 0 for success
    j end_trap

handle_write_number:
    # Base Case: Is the number zero?
    bnez a0, check_negative
    li t1, 48                       # ASCII '0'
    j print_single_char

check_negative:
    bge a0, zero, setup_extract
    li t1, 45                       # ASCII '-'
wait_minus:
    la t2, terminal_ready
    lw t3, 0(t2)
    andi t3, t3, 1
    beqz t3, wait_minus
    la t2, terminal_data
    sw t1, 0(t2)
    neg a0, a0                      # Make the number positive for division math

setup_extract:
    li t1, 10                       # Base 10 division tool
    li t4, 0                        # Digit stack counter

extract_loop:
    remu t2, a0, t1                 # t2 = a0 % 10 (get last digit)
    addi t2, t2, 48                 # Convert to ASCII character
    
    # Push ASCII digit onto the stack
    addi sp, sp, -4
    sw t2, 0(sp)
    
    divu a0, a0, t1                 # a0 = a0 / 10 (chop off last digit)
    addi t4, t4, 1                  # Increment digit counter
    bnez a0, extract_loop           # Keep looping until number is completely shredded

print_digits_loop:
    lw t1, 0(sp)                    # Pop the highest hierarchy digit off the stack
    addi sp, sp, 4
wait_digit:
    la t2, terminal_ready
    lw t3, 0(t2)
    andi t3, t3, 1
    beqz t3, wait_digit
    la t2, terminal_data
    sw t1, 0(t2)                    # Print it!

    addi t4, t4, -1                 # Decrement our digit counter
    bnez t4, print_digits_loop      # Loop if there are still digits left on the stack
    
    li a0, 0                        # Success!
    j end_trap

print_single_char:
wait_zero:
    la t2, terminal_ready
    lw t3, 0(t2)
    andi t3, t3, 1
    beqz t3, wait_zero
    la t2, terminal_data
    sw t1, 0(t2)
    li a0, 0                        # Success!

# =====================================================================
# SYSTEM CALL EXIT WRAPPERS
# =====================================================================
end_trap:
    # Crucial: Advance mepc by 4 bytes so we don't loop on the 'ecall' instruction
    csrr t0, mepc
    addi t0, t0, 4
    csrw mepc, t0

restore_and_exit:
    # Bring back the original temporary register values undamaged
    lw t0, 0(sp)
    lw t1, 4(sp)
    lw t2, 8(sp)
    lw t3, 12(sp)
    lw a7, 16(sp)
    lw a6, 20(sp)
    addi sp, sp, 24
    mret                            # Back to user space!