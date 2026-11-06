// Dedicated source build; importing this configuration opens no listener.
export default {
 publicDir:false,
 server:{host:'127.0.0.1',port:5294,strictPort:true},
 preview:{host:'127.0.0.1',port:5294,strictPort:true},
 build:{outDir:'dist-desktop-write-green',emptyOutDir:false,rollupOptions:{input:{desktopWriteGreen:'desktop-write-green.html'}}}
};
