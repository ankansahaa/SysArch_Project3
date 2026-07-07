# =====================================================================
#  USER PROGRAM
# =====================================================================

# Syscall constants
# EID = a7, FID = a6
# Console: EID=0x4442434E, FID=3(read),2(write)
# Time:    EID=0x54494D45, FID=1
# Suspend: EID=0x53555350, FID=0

user_suspend_to_ram:

    li sp 0x400000

    # Allocate stack space for:
    #   buffer[8] for "suspend"
    #   time_before[6 words]
    #   time_after[6 words]
    addi sp, sp, -88

    # Pointers
    addi s0, sp, 0          # buffer start
    addi s3, sp, 8          # comparison buffer start
    addi s1, sp, 40         # time_before
    addi s2, sp, 64         # time_after

    # Store "suspend"
    li t0 0x70737573        # psus
    sw t0 0(s3)
    li t0 0x00646E65        # \00dne
    sw t0 4(s3)

main_loop:
    # ------------------------------------------------------------
    # Compare against expected "suspend"
    # ------------------------------------------------------------
    mv t1 s3
    addi t2, zero, 0        # index = 0

match_loop:
    lb t3, 0(t1)            # expected char
    beqz t3, full_match     # reached end → full match

    # read next char
    li a7, 0x4442434E
    li a6, 3
    ecall
    mv t0, a1

    bne t0, t3, mismatch    # mismatch → flush buffer

    # store char into buffer
    sb t0, 0(s0)
    addi s0, s0, 1
    addi t1, t1, 1
    addi t2, t2, 1

    j match_loop

# ------------------------------------------------------------
# FULL MATCH → issue suspend syscall
# ------------------------------------------------------------
full_match:
    # Reset buffer pointer
    addi s0, sp, 0

    # ---- TIME BEFORE ----
    mv a1, s1
    li a7, 0x54494D45
    li a6, 1
    ecall

    # ---- SUSPEND ----
    li a7, 0x53555350
    li a6, 0
    li a0, 0              # sleep_type = 0
    la a1, after_suspend  # resume address
    ecall

after_suspend:
    # ---- TIME AFTER ----
    mv a1, s2
    li a7, 0x54494D45
    li a6, 1
    ecall

    # ------------------------------------------------------------
    # VERIFY STRICTLY GREATER
    # Compare 6 words: mtimeL,mtimeH,mcycleL,mcycleH,minstL,minstH
    # ------------------------------------------------------------
    addi t0, zero, 0       # index = 0

verify_loop:
    lw t1, 0(s1)           # before
    lw t2, 0(s2)           # after
    bgeu t2, t1, ok_word   # must be strictly greater → >= is OK
    j fail                 # otherwise fail

ok_word:
    addi s1, s1, 4
    addi s2, s2, 4
    addi t0, t0, 1
    li t3, 6
    blt t0, t3, verify_loop

    # Reset pointers
    addi s1, sp, 32
    addi s2, sp, 56

    j main_loop

# ------------------------------------------------------------
# MISMATCH → flush buffer to terminal
# ------------------------------------------------------------
mismatch:
    # print buffered chars
    addi t4, sp, 0         # ptr = buffer start
flush_loop:
    beq t4, s0, flush_done
    lb t5, 0(t4)

    li a7, 0x4442434E
    li a6, 2
    mv a0, t5
    ecall

    addi t4, t4, 1
    j flush_loop

flush_done:
    # reset buffer pointer
    addi s0, sp, 0

    # echo the mismatching char
    li a7, 0x4442434E
    li a6, 2
    mv a0, t0
    ecall

    j main_loop

# ------------------------------------------------------------
# FAIL LOOP
# ------------------------------------------------------------
fail:
    j fail
