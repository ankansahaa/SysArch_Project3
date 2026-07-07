package project3.utils

import java.io._

class TeeOutputStream(os1: OutputStream, os2: OutputStream)
    extends OutputStream {
  override def write(b: Int): Unit = {
    os1.write(b)
    os2.write(b)
  }

  override def write(b: Array[Byte]): Unit = {
    os1.write(b)
    os2.write(b)
  }

  override def write(b: Array[Byte], off: Int, len: Int): Unit = {
    os1.write(b, off, len)
    os2.write(b, off, len)
  }

  override def flush(): Unit = {
    os1.flush()
    os2.flush()
  }

  override def close(): Unit = {
    os1.close()
    os2.close()
  }
}
