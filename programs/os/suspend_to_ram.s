_start:
    # 1. Setup the exception handler address in mtvec
    la t0, exception_handler
    csrw mtvec, t0

    # 2. Setup mepc to point to the first instruction of the user program
    la t0, user_suspend_to_ram
    csrw mepc, t0

    # 3. Switch privilege mode to User Mode (clear MPP bits 11 and 12 in mstatus)
    li t0, 0x1800
    csrc mstatus, t0

    # 4. Blast off to user land!
    mret

# =====================================================================
# TRAP HANDLING & DISPATCHER ROUTING
# =====================================================================
exception_handler:
    # Save temporary registers on the stack
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

    # --- ROUTING TABLE ---
    
    # 1. Check Console Extension Route (EID = 0x4442434E)
    li t0, 0x4442434E
    bne a7, t0, check_time_route
    li t0, 3                         # FID 3 = Console Read
    beq a6, t0, handle_console_read
    li t0, 2                         # FID 2 = Console Write
    beq a6, t0, handle_console_write
    j invalid_call

check_time_route:
    # 2. Check Time Extension Route (EID = 0x54494D45)
    li t0, 0x54494D45
    bne a7, t0, check_suspend_route
    li t0, 1                         # FID 1 = Get Telemetry
    beq a6, t0, handle_time
    j invalid_call

check_suspend_route:
    # 3. Check Suspend Extension Route (EID = 0x53555350)
    li t0, 0x53555350
    bne a7, t0, invalid_call
    li t0, 0                         # FID 0 = Suspend
    beq a6, t0, handle_suspend

invalid_call:
    li a0, -1                        
    j end_trap

# =====================================================================
# SUBROUTINES IMPLEMENTATION
# =====================================================================

handle_console_read:
wait_terminal_rx:
    la t0, terminal_ready
    lw t1, 0(t0)
    andi t1, t1, 2                  
    beqz t1, wait_terminal_rx
    
    la t0, keyboard_data
    lw a1, 0(t0)                    
    j end_trap

handle_console_write:
wait_terminal_tx:
    la t0, terminal_ready
    lw t1, 0(t0)
    andi t1, t1, 1                  
    beqz t1, wait_terminal_tx
    
    la t0, terminal_data
    sw a0, 0(t0)                    
    j end_trap

handle_time:
    csrr t0, mcycle
    csrr t1, mcycleh
    csrr t2, minstret
    csrr t3, instreth
    csrr t4, time
    csrr t5, timeh

    sw t4, 0(a1)                    
    sw t5, 4(a1)                    
    sw t0, 8(a1)                    
    sw t1, 12(a1)                   
    sw t2, 16(a1)                   
    sw t3, 20(a1)                   
    
    li a0, 0                        
    j end_trap

handle_suspend:
    # Use a hardcoded safe RAM offset address completely bypasses directives!
    li t0, 0x3FFF00
    
    sw x5, 20(t0)                   
    sw a1, 128(t0)                  

    sw x1, 4(t0)                    
    sw x2, 8(t0)                    
    sw x3, 12(t0)                   
    sw x4, 16(t0)                   
    sw x6, 24(t0)                   
    sw x7, 28(t0)                   
    sw x8, 32(t0)                   
    sw x9, 36(t0)                   
    sw x10, 40(t0)                  
    sw x11, 44(t0)                  
    sw x12, 48(t0)                  
    sw x13, 52(t0)                  
    sw x14, 56(t0)                  
    sw x15, 60(t0)                  
    sw x16, 64(t0)                  
    sw x17, 68(t0)                  
    sw x18, 72(t0)                  
    sw x19, 76(t0)                  
    sw x20, 80(t0)                  
    sw x21, 84(t0)                  
    sw x22, 88(t0)                  
    sw x23, 92(t0)                  
    sw x24, 96(t0)                  
    sw x25, 100(t0)                 
    sw x26, 104(t0)                 
    sw x27, 108(t0)                 
    sw x28, 112(t0)                 
    sw x29, 116(t0)                 
    sw x30, 120(t0)                 
    sw x31, 124(t0)                 

    j _suspend

_resume_from_suspend:
    li t0, 0x3FFF00
    
    lw t1, 128(t0)                  
    csrw mepc, t1                   

    lw x1, 4(t0)                    
    lw x2, 8(t0)                    
    lw x3, 12(t0)                   
    lw x4, 16(t0)                   
    lw x7, 28(t0)                   
    lw x8, 32(t0)                   
    lw x9, 36(t0)                   
    lw x10, 40(t0)                  
    lw x11, 44(t0)                  
    lw x12, 48(t0)                  
    lw x13, 52(t0)                  
    lw x14, 56(t0)                  
    lw x15, 60(t0)                  
    lw x16, 64(t0)                  
    lw x17, 68(t0)                  
    lw x18, 72(t0)                  
    lw x19, 76(t0)                  
    lw x20, 80(t0)                  
    lw x21, 84(t0)                  
    lw x22, 88(t0)                  
    lw x23, 92(t0)                  
    lw x24, 96(t0)                  
    lw x25, 100(t0)                 
    lw x26, 104(t0)                 
    lw x27, 108(t0)                 
    lw x28, 112(t0)                 
    lw x29, 116(t0)                 
    lw x30, 120(t0)                 
    lw x31, 124(t0)                 
    
    lw x6, 24(t0)                   
    lw x5, 20(t0)                   

    mret

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

# ----------------------------------------------------------------------
# Simulated suspension. Do not touch this part.
# ----------------------------------------------------------------------
_suspend:
    nop
    nop
    j _resume_from_suspend