# Alpine 9p rootfs for the in-browser v86 VM.
# Adapted from copy/v86 tools/docker/alpine/Dockerfile @ 180830d539dcc87db1a191febf6c914f516d102f.
# Deltas from upstream: no nodejs/networking extras, serial console gets --nohostname,
# and rootfs-extra/ layers the BonziOS easter eggs on top.
FROM docker.io/i386/alpine:3.21.0

# virt (not lts) + linux-firmware-none is what keeps the exported rootfs ~30MB instead of >500MB
ENV KERNEL=virt

RUN apk add openrc alpine-base agetty alpine-conf linux-$KERNEL linux-firmware-none

RUN sed -i 's/getty 38400 tty1/agetty --autologin root tty1 linux/' /etc/inittab
RUN echo 'ttyS0::respawn:/sbin/agetty --autologin root --nohostname -s ttyS0 115200 vt100' >> /etc/inittab
RUN echo "root:" | chpasswd

RUN setup-hostname bonzi

# https://wiki.alpinelinux.org/wiki/Alpine_Linux_in_a_chroot#Preparing_init_services
RUN for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done
RUN for i in hwclock modules sysctl hostname syslog bootmisc; do rc-update add $i boot; done
RUN rc-update add killprocs shutdown

COPY rootfs-extra/ /
RUN chmod 755 /usr/local/bin/bonzi /etc/profile.d/bonzi.sh

# Generate initramfs with 9p modules
RUN mkinitfs -F "base virtio 9p" $(cat /usr/share/kernel/$KERNEL/kernel.release)
