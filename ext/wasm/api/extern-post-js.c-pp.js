
/* ^^^^ ACHTUNG: blank line at the start is necessary because
   Emscripten will not add a newline in some cases and we need
   a blank line for a sed-based kludge for the ES6 build. */
/* extern-post-js.js must be appended to the resulting sqlite3.js
   file. It gets its name from being used as the value for the
   --extern-post-js=... Emscripten flag. Note that this code, unlike
   most of the associated JS code, runs outside of the
   Emscripten-generated module init scope, in the current
   global scope. */
//#if target=es6-module
const toExportForES6 =
//#endif
(function(){
  /**
     In order to hide the sqlite3InitModule()'s resulting
     Emscripten module from downstream clients (and simplify our
     documentation by being able to elide those details), we hide that
     function and expose a hand-written sqlite3InitModule() to return
     the sqlite3 object (most of the time).

     Unfortunately, we cannot modify the module-loader/exporter-based
     impls which Emscripten installs at some point in the file above
     this.
  */
  const originalInit =
        /* Maintenance reminder: DO NOT use `self.` here. It's correct
           for non-ES6 Module cases but wrong for ES6 modules because those
           resolve this symbol differently. */ sqlite3InitModule;
  if(!originalInit){
    throw new Error("Expecting self.sqlite3InitModule to be defined by the Emscripten build.");
  }
  /**
     We need to add some state which our custom Module.locateFile()
     can see, but an Emscripten limitation currently prevents us from
     attaching it to the sqlite3InitModule function object:

     https://github.com/emscripten-core/emscripten/issues/18071

     The only(?) current workaround is to temporarily stash this state
     into the global scope and delete it when sqlite3InitModule()
     is called.
  */
  const initModuleState = self.sqlite3InitModuleState = Object.assign(Object.create(null),{
    moduleScript: self?.document?.currentScript,
    isWorker: ('undefined' !== typeof WorkerGlobalScope),
    location: self.location,
    urlParams:
//#if target=es6-bundler-friendly
    undefined
//#else
    new URL(self.location.href).searchParams
//#endif
  });
  initModuleState.debugModule =
//#if target=es6-bundler-friendly
  ()=>{}
//#else
  (new URL(self.location.href).searchParams).has('sqlite3.debugModule')
    ? (...args)=>console.warn('sqlite3.debugModule:',...args)
    : ()=>{};
//#endif

  if(initModuleState.urlParams && initModuleState.urlParams.has('sqlite3.dir')){
    initModuleState.sqlite3Dir = initModuleState.urlParams.get('sqlite3.dir') +'/';
  }else if(initModuleState.moduleScript){
    const li = initModuleState.moduleScript.src.split('/');
    li.pop();
    initModuleState.sqlite3Dir = li.join('/') + '/';
  }

  self.sqlite3InitModule = function ff(...args){
    //console.warn("Using replaced sqlite3InitModule()",self.location);
    return originalInit(...args).then((EmscriptenModule)=>{
      if(self.window!==self &&
         (EmscriptenModule['ENVIRONMENT_IS_PTHREAD']
          || EmscriptenModule['_pthread_self']
          || 'function'===typeof threadAlert
          || self.location.pathname.endsWith('.worker.js')
         )){
        /** Workaround for wasmfs-generated worker, which calls this
            routine from each individual thread and requires that its
            argument be returned. All of the criteria above are fragile,
            based solely on inspection of the offending code, not public
            Emscripten details. */
        return EmscriptenModule;
      }
      const s = EmscriptenModule.sqlite3;
      s.scriptInfo = initModuleState;
      //console.warn("sqlite3.scriptInfo =",s.scriptInfo);
      if(ff.__isUnderTest) s.__isUnderTest = true;
      const f = s.asyncPostInit;
      delete s.asyncPostInit;
      return f();
    }).catch((e)=>{
      console.error("Exception loading sqlite3 module:",e);
      throw e;
    });
  };
  self.sqlite3InitModule.ready = originalInit.ready;

  if(self.sqlite3InitModuleState.moduleScript){
    const sim = self.sqlite3InitModuleState;
    let src = sim.moduleScript.src.split('/');
    src.pop();
    sim.scriptDir = src.join('/') + '/';
  }
  initModuleState.debugModule('sqlite3InitModuleState =',initModuleState);
  if(0){
    console.warn("Replaced sqlite3InitModule()");
    console.warn("self.location.href =",self.location.href);
    if('undefined' !== typeof document){
      console.warn("document.currentScript.src =",
                   document?.currentScript?.src);
    }
  }
//#ifnot target=es6-module
// Emscripten does not inject these module-loader bits in ES6 module
// build and including them here breaks JS bundlers, so elide them
// from ES6 builds.
  /* Replace the various module exports performed by the Emscripten
     glue... */
  if (typeof exports === 'object' && typeof module === 'object'){
    module.exports = sqlite3InitModule;
  }else if (typeof exports === 'object'){
    exports["sqlite3InitModule"] = sqlite3InitModule;
  }
  /* AMD modules get injected in a way we cannot override,
     so we can't handle those here. */
//#endif // !target=es6-module
  return self.sqlite3InitModule /* required for ESM */;
})();
//#if target=es6-module
export default toExportForES6;
//#endif