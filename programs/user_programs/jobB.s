# Job B:
# 1. Create 8 dummy jobs with short execution time
# 3. exit

    li t1, 8            # number of dummy jobs to create
    li a1, 10           # run each dummy job for 10 cycles
    li a7, 0x0A000000   # syscall number for create process
    li a6, 0x0

job_loop:
    beq t1, zero, exit_job # if no more dummy jobs to create,
    la a0, dummy_job    # load address of dummy_job
    ecall               # create dummy job
    bne a0, zero, failure
    addi t1, t1, -1     # decrement the number of dummy jobs
    j job_loop          # repeat until all dummy jobs are created
exit_job:              
    li a7, 0x0A000000   # exit the process
    li a6, 0x1
    ecall               # ------- " -------
    
failure:
    j failure