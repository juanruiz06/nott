// Páginas puente: lógica común. Cada página llama a NottPuente.init({ path: fn }) con una
// función que, a partir de los parámetros de la URL, devuelve la ruta interna de la app
// ('profile/<id>?c=…', 'plan/<id>?date=…') o '' si el enlace viene incompleto.
//
// spec 068: el esquema sigue siendo nox:// a propósito. Las versiones 1.0.0/1.1.0 solo entienden
// ese; la 1.2.0 (NOTT) entiende nox:// y nott://. Cambiarlo dejaría fuera a los que no han actualizado.
//
// Por qué ya NO se abre la app sola en iPhone (2026-10-09): desde la 1.1.0 los universal links
// abren la app ANTES de cargar esta página, así que quien la ve casi siempre NO tiene NOTT, y el
// nox:// automático le soltaba el error de Safari «la dirección no es válida». Ahora son dos pasos
// con nombre (1 descargar, 2 abrir) y el banner nativo de Safari (apple-itunes-app), que sabe si
// la app está instalada y dice «Abrir» u «Obtener» por sí mismo.
//
// En Android el botón de abrir usa intent://: abre NOTT si está instalada y, si no, Chrome
// manda a Google Play (S.browser_fallback_url). Un nox:// pelado no hacía nada sin la app.
//
// El código de quien te invita (una persona, un RRPP o un creador) tiene que sobrevivir a la
// tienda, porque quien ve esta página casi nunca tiene NOTT y la abrirá desde el icono:
//   · Android: viaja en el enlace de Google Play (`referrer=nott_code%3D<código>`) y Play se lo
//     entrega a la app la primera vez que se abre. Nadie tiene que hacer nada.
//   · iPhone: Apple no tiene equivalente. Al tocar «Descargar» se copia este enlace, y en el alta
//     («¿Te ha invitado alguien?») se pega con un toque. Se copia dentro del propio toque: Safari
//     no deja copiar después. Si el navegador no deja (pasa en algunos navegadores internos de
//     otras apps), se va a la tienda igual.
// Las páginas que llevan código (/a/ y /u/) lo dicen con `codigo` en init().
(function(){
  var PKG='com.juanruiz.nox';
  var PLAY='https://play.google.com/store/apps/details?id='+PKG;
  var ua=navigator.userAgent||'';
  // iPadOS se anuncia como Mac: lo delata la pantalla táctil.
  var ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
  var android=/Android/i.test(ua);
  var os=ios?'ios':android?'android':'desktop';
  document.documentElement.setAttribute('data-os',os);

  function param(name){
    var q=window.location.search.replace(/^\?/,'');
    var parts=q.split('&');
    for(var k=0;k<parts.length;k++){
      if(!parts[k]){continue;}
      var eq=parts[k].indexOf('=');
      var key=eq===-1?parts[k]:parts[k].slice(0,eq);
      if(decodeURIComponent(key.replace(/\+/g,' '))!==name){continue;}
      var raw=eq===-1?'':parts[k].slice(eq+1);
      try{return decodeURIComponent(raw.replace(/\+/g,' '));}catch(e){return '';}
    }
    return '';
  }
  function ok(v,re){return v&&re.test(v)?v:'';}

  var CODE=/^[0-9A-Za-z]{22}$/;
  function playUrl(codigo){
    return CODE.test(codigo||'')?PLAY+'&referrer='+encodeURIComponent('nott_code='+codigo):PLAY;
  }

  function openHref(path,codigo){
    if(android){
      return 'intent://'+path+'#Intent;scheme=nox;package='+PKG+';S.browser_fallback_url='+encodeURIComponent(playUrl(codigo))+';end';
    }
    return 'nox://'+path;
  }

  // Lo que se copia en iPhone: este mismo enlace, sin el fragmento. La app saca el código de él.
  function enlaceParaCopiar(loc){
    return loc.origin+loc.pathname+loc.search;
  }

  function llevarCodigo(codigo){
    var play=document.querySelector('a.btn-store.only-android');
    if(play){play.setAttribute('href',playUrl(codigo));}
    var store=document.querySelector('a.btn-store.only-ios');
    var cb=navigator.clipboard;
    if(!ios||!store||!cb||typeof cb.writeText!=='function'){return;}
    var hint=document.getElementById('dl-hint');
    if(hint){hint.textContent='Es gratis. Al tocar, copiamos tu invitación: pégala cuando NOTT te pregunte quién te invitó.';}
    store.addEventListener('click',function(e){
      e.preventDefault();
      var ir=function(){window.location.href=store.getAttribute('href');};
      // Copie o no, se va a la tienda: sin la copia queda buscar a quien te invitó por su @.
      cb.writeText(enlaceParaCopiar(window.location)).then(ir,ir);
    });
  }

  // «de»: el @ de quien invita, solo para enseñarlo. No atribuye nada: es por si no se puede
  // copiar, para que en el alta se le pueda buscar por su nombre.
  function decirQuien(){
    var de=ok(param('de'),/^[a-z0-9._]{3,30}$/);
    var hint=document.getElementById('dl-hint');
    if(!de||!hint||!hint.parentNode){return;}
    var p=document.createElement('p');
    p.className='only-mobile';
    p.textContent='Si NOTT te pregunta quién te invitó, busca @'+de+'.';
    hint.parentNode.appendChild(p);
  }

  window.NottPuente={
    param:param,
    ok:ok,
    ID:/^[A-Za-z0-9._-]{1,80}$/,
    CODE:CODE,
    playUrl:playUrl,
    enlaceParaCopiar:enlaceParaCopiar,
    init:function(opts){
      var path=opts.path(param,ok);
      var codigo=opts.codigo?ok(opts.codigo(param,ok),CODE):'';
      var step=document.getElementById('step-open');
      var btn=document.getElementById('open');
      var miss=document.getElementById('missing');
      if(path){
        btn.setAttribute('href',openHref(path,codigo));
        // En ordenador no hay app que abrir: el paso 2 dice que se haga desde el móvil.
        if(step){step.hidden=false;}
      }else{
        if(step){step.hidden=true;}
        if(miss){miss.hidden=false;}
        // Sin paso 2, el «pasa al paso 2» del paso 1 sobra.
        var hint=document.getElementById('dl-hint');
        if(hint){hint.textContent='Es gratis.';}
      }
      if(codigo){llevarCodigo(codigo);decirQuien();}
      if(opts.after){opts.after(path);}
    }
  };
})();
