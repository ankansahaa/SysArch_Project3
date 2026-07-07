    la a0, job_A        # load address of job_A
    li a1, 100          # run for 100 cycles
    li a7, 0x0A000000   # create new process
    li a6, 0x0
    ecall               # ------- " -------
    li a7, 0x0A000000   # exit the process
    li a6, 0x1
    ecall               # ------- " -------

