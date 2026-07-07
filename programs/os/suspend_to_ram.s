_start:
    # TODO: setup exception handler
    # TODO: setup mepc to point to the first instruction of the startup process
    # TODO: enable and setup interrupts as needed
    # TODO: jump to user mode

exception_handler:
    # TODO: save some registers
    # TODO: handle the exception
    # TODO: return to user program

handle_console_read:
    # TODO: read a character from the keyboard

handle_console_write:
    # TODO: write a character to the console

handle_time:
    # TODO: dump mtime, mcycle and minstret at provided address

handle_suspend:
    # TODO: save state to memory
    # TODO: jump to _suspend

_resume_from_suspend:
    # TODO: restore state from memory
    # TODO: return to user program


# ----------------------------------------------------------------------
# Simulated suspension. Do not touch this part.
# ----------------------------------------------------------------------
_suspend:
    nop
    nop
    j _resume_from_suspend
