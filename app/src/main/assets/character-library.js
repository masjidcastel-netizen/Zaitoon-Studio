/* Character collection and customization stay in the same-origin studio. */
(()=>{
 const palettes=['#25836b','#2868a6','#7856a0','#bd6552','#526d89','#308783','#77555e','#667d3b','#a77035','#456caa','#774f91'];
 const defaults=ToonTools.names.map((name,i)=>({id:'preset-'+i,name,category:i===0?'imam':'community',style:'muslim',clothing:i===0?'robe':'tunic',color:palettes[i],trim:'#f2e8c9',skin:'#bb835c',accessory:i===0?'turban':'cap',animation:i===0?'greet':'idle'}));
 let collection=defaults.map(c=>({...c}));
 try{const saved=JSON.parse(localStorage.getItem('toon-collection')||'null');if(Array.isArray(saved)&&saved.length)collection=saved}catch(e){}
 const saveCollection=()=>localStorage.setItem('toon-collection',JSON.stringify(collection));
 let basePromise,requests=[0,0];
 const base=()=>basePromise||(basePromise=new Promise((resolve,reject)=>new THREE.GLTFLoader().load('/models/modest-base.glb',resolve,undefined,reject)).catch(e=>{basePromise=null;throw e}));
 const select=()=>+$('#wkc').value;
 window.applyMuslim=async(i,config)=>{
  const request=++requests[i];say('Loading '+config.name+'…');
  try{const source=await base();if(request!==requests[i])return;
   const root=THREE.SkeletonUtils.clone(source.scene);
   root.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();o.material.roughness=.75}});
   root.updateMatrixWorld(true);
   const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),h=size.y;
   const extras=new THREE.Group();root.add(extras);
   const cloth=M(config.color,.85),trim=M(config.trim,.55);
   // Modest full-body silhouette over the CC0 rig, with two independently moving arms.
   const torso=root.getObjectByName('torso'),head=root.getObjectByName('head');
   const add=(geo,mat,x,y,z,parent=extras)=>mesh(geo,mat,x,y,z,0,parent);
   const robe=add(new THREE.CylinderGeometry(h*.2,h*(config.clothing==='robe'?.26:.22),h*(config.clothing==='robe'?.56:.4),32),cloth,center.x,box.min.y+h*.34,center.z);
   if(torso)torso.attach(robe);
   const sash=add(new THREE.CylinderGeometry(h*.204,h*.206,h*.045,32),trim,center.x,box.min.y+h*.56,center.z);if(torso)torso.attach(sash);
   for(const side of ['left','right']){const arm=root.getObjectByName('arm-'+side);if(arm){const world=arm.getWorldPosition(new THREE.Vector3());const sleeve=add(new THREE.SphereGeometry(h*.1,24,16),cloth,world.x,world.y,world.z);sleeve.scale.set(1,1.6,1);arm.attach(sleeve)}}
   if(config.accessory!=='none'){
    const cap=add(new THREE.CylinderGeometry(h*.34,h*.355,h*(config.accessory==='turban'?.16:.1),40),trim,center.x,box.max.y+h*.025,center.z);if(head)head.attach(cap);
    if(config.accessory==='turban'){const band=add(new THREE.TorusGeometry(h*.345,h*.035,12,40),cloth,center.x,box.max.y,center.z);band.rotation.x=Math.PI/2;if(head)head.attach(band)}
   }
   if(config.accessory==='glasses'){for(const sign of[-1,1]){const glass=add(new THREE.TorusGeometry(h*.065,h*.009,8,24),M('#30343a'),center.x+sign*h*.075,box.min.y+h*.79,box.max.z+h*.005);if(head)head.attach(glass)}}
   root.traverse(o=>{if(o.isMesh&&/head-mesh/.test(o.name)){o.material.color.set(config.skin)}});
   root.name=config.name;
   const clips=[];
   const times=Array.from({length:49},(_,k)=>k/24);
   for(const action of ToonTools.actions){
    const tracks=[];
    for(const [nodeName,key,axis] of [['head','hx','x'],['arm-right','aA','z'],['arm-left','aB','z']]){
     const node=root.getObjectByName(nodeName);if(!node)continue;const values=[];
     for(const t of times){const p=ToonTools.pose(action,t),angle=key==='hx'?p.hx+p.hz:(p[key]-(key==='aA'?.2:-.2));const rotation=node.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axis==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),angle));values.push(...rotation.toArray())}
     tracks.push(new THREE.QuaternionKeyframeTrack(nodeName+'.quaternion',times,values));
    }
    const walking=source.animations.find(c=>c.name==='walk');clips.push(action==='walk'&&walking?walking:new THREE.AnimationClip(action,2,tracks));
   }
   place(i,{scene:root,animations:clips});IM[i].userData.library=true;
   S.chars[i]={...S.chars[i],...config,style:'muslim'};syncChars();list();persist();window.toonPreview?.(i,config.animation||'idle');say(config.name+' ready.');
  }catch(e){say('Character model could not load. Check your connection and try again.')}
 };
 function showSettings(){const c=S.chars[select()];$('#libname').value=c.name;$('#libclothes').value=c.clothing||'robe';$('#libcolor').value=c.color||palettes[0];$('#libtrim').value=c.trim||'#f2e8c9';$('#libskin').value=c.skin||'#bb835c';$('#libaccessory').value=c.accessory||'cap';$('#libanimation').value=c.animation||'idle'}
 function settings(){return {...S.chars[select()],name:$('#libname').value.trim().slice(0,20)||'My character',style:'muslim',clothing:$('#libclothes').value,color:$('#libcolor').value,trim:$('#libtrim').value,skin:$('#libskin').value,accessory:$('#libaccessory').value,animation:$('#libanimation').value}}
 function render(){const q=$('#libsearch').value.toLowerCase(),filter=$('#libfilter').value,items=collection.filter(c=>(c.name.toLowerCase().includes(q))&&(filter==='all'||c.category===filter));const box=$('#libitems');box.replaceChildren();$('#libcount').textContent=items.length+' characters';
  for(const c of items){const item=document.createElement('article');item.className='lib-item';const name=document.createElement('strong');name.textContent=c.name;const meta=document.createElement('span');meta.className='s';meta.textContent=(c.category==='imam'?'Imam':c.category==='custom'?'My collection':'Community')+' · '+c.clothing+' · '+c.animation;const use=document.createElement('button');use.className='alt';use.textContent='Use '+c.name;use.onclick=()=>{applyMuslim(select(),c).then(showSettings)};item.append(name,meta,use);if(c.category==='custom'){const remove=document.createElement('button');remove.className='alt';remove.textContent='✕';remove.ariaLabel='Delete '+c.name;remove.onclick=()=>{collection=collection.filter(x=>x.id!==c.id);saveCollection();render()};item.append(remove)}box.append(item)}
 }
 $('#libanimation').innerHTML=ToonTools.actions.map(a=>`<option value="${a}">${a}</option>`).join('');
 $('#libsearch').oninput=render;$('#libfilter').onchange=render;
 $('#libapply').onclick=()=>applyMuslim(select(),settings());
 $('#libpreview').onclick=()=>{const i=select(),a=$('#libanimation').value;S.chars[i].animation=a;persist();window.toonPreview?.(i,a);say('Previewing '+a+' on '+S.chars[i].name)};
 $('#libsave').onclick=()=>{const current=settings(),id=current.category==='custom'?current.id:'custom-'+Date.now(),config={...current,id,category:'custom'};const index=collection.findIndex(c=>c.id===id);if(index<0)collection.push(config);else collection[index]=config;S.chars[select()]={...S.chars[select()],id,category:'custom'};persist();saveCollection();render();say(config.name+' saved to your collection on this device.')};
 $('#libduplicate').onclick=()=>{const config={...settings(),id:'custom-'+Date.now(),category:'custom',name:(settings().name.slice(0,15)+' copy').slice(0,20)};collection.push(config);saveCollection();render();applyMuslim(select(),config).then(showSettings)};
 $('#libreset').onclick=()=>{const c=S.chars[select()],original=defaults.find(d=>d.id===c.id)||defaults.find(d=>d.name===c.name)||defaults[0];applyMuslim(select(),{...original}).then(showSettings)};
 $('#wkc').addEventListener('change',showSettings);for(const i of[0,1])$('#cn'+i).addEventListener('input',showSettings);
 $('#libstop').onclick=()=>{S.chars[select()].animation='idle';persist();window.toonPreview?.(select(),null)};
 render();showSettings();for(const i of[0,1])if(S.chars[i].style==='muslim')applyMuslim(i,S.chars[i]);
})();