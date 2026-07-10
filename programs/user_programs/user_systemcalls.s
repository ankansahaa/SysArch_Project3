start:
	jal ra, print_fixed_string
    li t0 1000
    jal ra, wait_long
	jal ra, print_string
	jal ra, print_42
	jal ra, print_neg_42
	j start

print_string:
	li a0, 0x00020000 # start address of string
	li t0, 0x48   # 0x48-> "H"
	sb t0, 0(a0)
	li t0, 0x65   # 0x65 -> "e"
	sb t0, 1(a0)
	li t0, 0x6c   # 0x6c -> "l"
	sb t0, 2(a0)
	sb t0, 3(a0)
	li t0, 0x6f   # 0x6f -> "o"
	sb t0, 4(a0)
	sb x0, 5(a0)  # null terminator
    li a7, 0x4442434E      # EID = "DBCN"
    li a6, 4               # FID = Console Write String
	ecall
	ret

print_fixed_string:
    li a0, 0x00010000      # address of fixed string
    li a7, 0x4442434E      # EID = "DBCN"
    li a6, 4               # FID = Console Write String
	ecall
	ret

print_42:
    li a0, 0x0000002A      # 42 in HEX
    li a7, 0x4442434E      # EID = "DBCN"
    li a6, 5               # FID = Console Write Number
	ecall
	ret


print_neg_42:
    li a0, 0xFFFFFFD6      # -42 in HEX
    li a7, 0x4442434E      # EID = "DBCN"
    li a6, 5               # FID = Console Write Number
	ecall
	ret

wait_long:
    addi t0, t0, -1
    bne t0, x0 wait_long
    ret