_start: 
    # TODO: setup exception handler
    # TODO: setup mepc to point to the first instruction of the startup process
    # TODO: enable and setup interrupts as needed
    # TODO: setup buffer for characters
    # TODO: jump to user mode

exception_handler:
    # TODO: save some registers
    # TODO: handle the exception
    # TODO: return to user program

handle_write_string:
    # TODO: schedule print null-terminated string to terminal

handle_write_number:
    # TODO: convert integer to decimal string
    # TODO: schedule print signed integer to terminal

handle_interrupt:
    # TODO: if it was a terminal interrupt, print the next character