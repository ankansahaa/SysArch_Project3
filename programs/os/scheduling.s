_start: 
    # TODO: setup exception handler
    # TODO: setup mepc to point to the first instruction of the startup process
    # TODO: enable and setup interrupts as needed
    # TODO: jump to user mode

exception_handler:
    # TODO: save some registers
    # TODO: update estimated time to completion of current process
    # TODO: handle the exception
    # TODO: schedule next process

create_process:
    # TODO: assign new process ID (if less than 8 non-startup processes exist)
    # TODO: set up new process control block 
    # TODO: continue with the right process at the right address

kill_process:
    # TODO: remove the current process from the sacheduler

# ----------------------------------------------------------------------
# Simulated shutdown. Do not touch this part.
# ----------------------------------------------------------------------
shutdown:
    j shutdown # infinite loop