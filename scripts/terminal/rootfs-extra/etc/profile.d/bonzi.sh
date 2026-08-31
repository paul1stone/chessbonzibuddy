# The joke: a DOS prompt in front of a real Linux kernel.
# busybox ash unescapes PS1 twice, so a literal \ needs four backslashes here.
export PS1='C:\\\\> '
export PAGER=more
cd /home/bonzi 2>/dev/null || true
