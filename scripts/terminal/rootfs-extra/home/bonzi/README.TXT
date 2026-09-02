BONZI BUDDY - README.TXT
========================

Congratulations. You are running a real 32-bit Linux kernel inside a
browser tab. Not a fake shell. Not a transcript. An actual kernel that
actually booted, which is why you got to watch it do so.

  Emulator ....... v86 (x86 -> WebAssembly JIT)
  Userland ....... Alpine Linux + BusyBox
  Root device .... a 9p filesystem streamed over HTTP
  Network ........ none, on purpose. You are sealed in.
  Prompt ......... C:\> (this part is a lie)

Nothing you type leaves the tab. Nothing you change survives a reload.
So go ahead and break things.

Things worth trying:

  help                     this list, from the prompt
  bonzi                    wisdom, dispensed at random
  cat chess_openings.txt   my opening repertoire, annotated
  cat /etc/motd            the greeting, again
  uname -a                 proof
  ps aux                   real processes, doing real nothing
  rm -rf /                 I dare you. It grows back.
