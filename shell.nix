{ pkgs ? import <nixpkgs> {} }:

let
  libs = with pkgs; [
    libx11
    libxcomposite
    libxdamage
    libxext
    libxfixes
    libxrandr
    libxcb
    libxshmfence
    mesa
    libgbm
    libGL
    libglvnd
    nss
    nspr
    alsa-lib
    atk
    at-spi2-atk
    cups
    dbus
    expat
    gdk-pixbuf
    glib
    gtk3
    pciutils
    libdrm
    libxkbcommon
    systemd
    cairo
    pango
  ];
in
pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_22
    python3
    pkg-config
    cairo
    pango
    libpng
    libjpeg
    giflib
    librsvg
    pixman
  ] ++ libs;

  shellHook = ''
    export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath libs}:$LD_LIBRARY_PATH"

    echo "Bruno dev shell ready."
    echo ""
    echo "Setup:    npm run setup"
    echo "Dev web:  npm run dev:web     (terminal 1)"
    echo "Dev app:  npm run dev:electron (terminal 2)"
  '';
}
