(function(e){function t(t){for(var o,r,s=t[0],l=t[1],u=t[2],p=0,d=[];p<s.length;p++)r=s[p],Object.prototype.hasOwnProperty.call(i,r)&&i[r]&&d.push(i[r][0]),i[r]=0;for(o in l)Object.prototype.hasOwnProperty.call(l,o)&&(e[o]=l[o]);c&&c(t);while(d.length)d.shift()();return a.push.apply(a,u||[]),n()}function n(){for(var e,t=0;t<a.length;t++){for(var n=a[t],o=!0,s=1;s<n.length;s++){var l=n[s];0!==i[l]&&(o=!1)}o&&(a.splice(t--,1),e=r(r.s=n[0]))}return e}var o={},i={app:0},a=[];function r(t){if(o[t])return o[t].exports;var n=o[t]={i:t,l:!1,exports:{}};return e[t].call(n.exports,n,n.exports,r),n.l=!0,n.exports}r.m=e,r.c=o,r.d=function(e,t,n){r.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},r.r=function(e){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.t=function(e,t){if(1&t&&(e=r(e)),8&t)return e;if(4&t&&"object"===typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(r.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var o in e)r.d(n,o,function(t){return e[t]}.bind(null,o));return n},r.n=function(e){var t=e&&e.__esModule?function(){return e["default"]}:function(){return e};return r.d(t,"a",t),t},r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.p="/chart-editor/";var s=window["webpackJsonp"]=window["webpackJsonp"]||[],l=s.push.bind(s);s.push=t,s=s.slice();for(var u=0;u<s.length;u++)t(s[u]);var c=l;a.push([0,"chunk-vendors"]),n()})({0:function(e,t,n){e.exports=n("56d7")},"0ebb":function(e,t,n){"use strict";var o=n("5e9b"),i=n.n(o);i.a},4678:function(e,t,n){},"56d7":function(e,t,n){"use strict";n.r(t);n("e260"),n("e6cf"),n("cca6"),n("a79d");var o=n("2b0e"),i=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("v-app",{attrs:{id:"app"}},[n("Preview",{attrs:{currentChart:e.currentChart,infoObject:e.chartObject.info,measureData:e.measureData,previewAudio:e.previewAudio,appendNote:e.getAppendNote}}),n("v-container",{staticClass:"panel",attrs:{fluid:""}},[n("h3",[e._v("譜面ファイル")]),n("v-row",{attrs:{align:"center"}},[n("v-file-input",{attrs:{accept:".json, application/json",label:"ファイルを選択","hide-details":"",outlined:"",dense:"","prepend-icon":"mdi-folder"},on:{change:e.readFile}}),n("v-col",[n("v-select",{attrs:{items:e.difficulties,label:"難易度",align:"left","hide-details":"",outlined:"",dense:""},model:{value:e.currentDifficulty,callback:function(t){e.currentDifficulty=t},expression:"currentDifficulty"}})],1)],1),n("h3",[e._v("ノートの挿入")]),n("v-checkbox",{attrs:{label:"ノート挿入モード"},model:{value:e.isAppendMode,callback:function(t){e.isAppendMode=t},expression:"isAppendMode"}}),e.isAppendMode?n("div",[n("v-row",[n("v-col",{attrs:{cols:"12",sm:"3"}},[n("v-select",{attrs:{items:e.noteTypes,"hide-details":"",label:"ノート種別",outlined:"",dense:""},model:{value:e.appendNote.type,callback:function(t){e.$set(e.appendNote,"type",t)},expression:"appendNote.type"}})],1),n("v-col",{attrs:{cols:"12",sm:"3"}},[n("v-text-field",{attrs:{label:"measure",outlined:"",dense:"","hide-details":"",type:"number",min:"0"},model:{value:e.appendNote.measure,callback:function(t){e.$set(e.appendNote,"measure",e._n(t))},expression:"appendNote.measure"}})],1),n("v-col",{attrs:{cols:"12",sm:"3"}},[n("v-text-field",{attrs:{label:"position",outlined:"",dense:"","hide-details":"",type:"number",min:"0",max:e.appendNote.split-1,"background-color":"#f0f0b0"},on:{keydown:[function(t){return!t.type.indexOf("key")&&e._k(t.keyCode,"enter",13,t.key,"Enter")?null:e.appendNotes([e.appendNote])},function(t){return!t.type.indexOf("key")&&e._k(t.keyCode,"left",37,t.key,["Left","ArrowLeft"])||"button"in t&&0!==t.button?null:e.appendNoteToLeft(t)},function(t){return!t.type.indexOf("key")&&e._k(t.keyCode,"right",39,t.key,["Right","ArrowRight"])||"button"in t&&2!==t.button?null:e.appendNoteToRight(t)}]},model:{value:e.appendNote.position,callback:function(t){e.$set(e.appendNote,"position",e._n(t))},expression:"appendNote.position"}})],1),n("v-col",{attrs:{cols:"12",sm:"3"}},[n("v-text-field",{attrs:{label:"split",outlined:"",dense:"","hide-details":"",type:"number",min:"0"},model:{value:e.appendNote.split,callback:function(t){e.$set(e.appendNote,"split",e._n(t))},expression:"appendNote.split"}})],1)],1),e._l(e.noteOptions(e.appendNote),(function(t,o){return n("div",{key:"option_"+o,staticClass:"mb-4"},[n("v-text-field",{attrs:{"hide-details":"",label:t.label,type:t.type,"append-outer-icon":"mdi-help",outlined:"",dense:""},on:{"click:append-outer":e.scrollTo},model:{value:e.appendNote.option[o],callback:function(t){e.$set(e.appendNote.option,o,t)},expression:"appendNote.option[i]"}})],1)})),n("v-row",{attrs:{align:"center",justify:"space-between"}},[n("v-radio-group",{attrs:{row:"","prepend-icon":"mdi-view-column-outline"},model:{value:e.appendNote.lane,callback:function(t){e.$set(e.appendNote,"lane",t)},expression:"appendNote.lane"}},e._l(5,(function(e){return n("v-radio",{key:e,attrs:{value:e}})})),1),n("v-btn",{staticClass:"ml-1",attrs:{color:"primary"},on:{click:function(t){return e.appendNotes([e.appendNote])}}},[e._v(" ノートを挿入 "),n("v-icon",{attrs:{right:""}},[e._v("mdi-keyboard-return")])],1)],1)],2):e._e(),n("h3",[e._v("プレビュー設定")]),n("v-slider",{attrs:{min:"20",max:"300","append-icon":"mdi-magnify-plus-outline","prepend-icon":"mdi-magnify-minus-outline",step:"10","thumb-label":""},on:{"click:append":e.zoomIn,"click:prepend":e.zoomOut},model:{value:e.beatHeight,callback:function(t){e.beatHeight=t},expression:"beatHeight"}}),n("v-row",{attrs:{align:"center"}},[n("v-file-input",{attrs:{accept:"audio/*",label:"楽曲ファイル選択",outlined:"",dense:"","prepend-icon":"mdi-music"},on:{change:e.readAudioFile}})],1),n("v-row",{staticClass:"mb-8",attrs:{align:"center"}},[n("v-text-field",{attrs:{suffix:"小節へ",outlined:"",dense:"","hide-details":""},model:{value:e.scrollTo,callback:function(t){e.scrollTo=e._n(t)},expression:"scrollTo"}}),n("v-btn",{staticClass:"ml-4",attrs:{color:"primary"},on:{click:function(t){return e.scrollToMeasure(e.scrollTo)}}},[n("v-icon",{attrs:{left:""}},[e._v("mdi-arrow-right")]),e._v(" 遷移 ")],1)],1),n("h3",[e._v("譜面情報")]),n("v-row",{attrs:{align:"center"}},[n("v-col",[n("v-text-field",{attrs:{label:"オフセット",required:"",outlined:"",dense:""},model:{value:e.chartObject.info.offset,callback:function(t){e.$set(e.chartObject.info,"offset",e._n(t))},expression:"chartObject.info.offset"}})],1),n("v-col",[n("v-text-field",{attrs:{label:"BPM",required:"",outlined:"",dense:""},model:{value:e.chartObject.info.bpm,callback:function(t){e.$set(e.chartObject.info,"bpm",e._n(t))},expression:"chartObject.info.bpm"}})],1),n("v-col",[n("v-text-field",{attrs:{label:"拍子",required:"",outlined:"",dense:""},model:{value:e.chartObject.info.beat,callback:function(t){e.$set(e.chartObject.info,"beat",e._n(t))},expression:"chartObject.info.beat"}})],1)],1),n("v-row",[n("v-btn",{staticClass:"ml-1",attrs:{color:"success"},on:{click:e.saveFile}},[n("v-icon",{attrs:{left:""}},[e._v("mdi-content-save")]),e._v(" 名前をつけて保存 ")],1)],1)],1)],1)},a=[],r=(n("7db0"),n("4160"),n("b0c0"),n("d3b7"),n("3ca3"),n("159b"),n("ddb0"),n("2b3d"),n("0be7")),s=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",[n("div",{ref:"preview",staticClass:"preview",style:{position:e.isPreviewing?"fixed":"relative",height:e.entireHeight+"px"}},[e._l(e.measureData,(function(t){return n("Measure",{key:"measure_"+t.measure,attrs:{measure:t,notes:e.currentChart.filter((function(e){return e.measure===t.measure}))}})})),e._l(e.currentChart.filter((function(e){return 2===e.type})),(function(t,o){return n("LongNote",{key:"longnote_"+o,attrs:{note:t,measureData:e.measureData}})})),e.appendNote?n("NoteShadow",{attrs:{note:e.appendNote,measureData:e.measureData}}):e._e()],2),n("div",{staticClass:"control"},[n("v-expansion-panels",{attrs:{accordion:""}},[n("v-expansion-panel",[n("v-expansion-panel-header"),n("v-expansion-panel-content",[n("v-text-field",{attrs:{suffix:"小節から",outlined:"",dense:""},model:{value:e.startFrom,callback:function(t){e.startFrom=e._n(t)},expression:"startFrom"}}),n("v-btn",{staticClass:"mr-1",attrs:{outlined:"",color:"success",disabled:e.isPreviewing},on:{click:e.previewStart}},[n("v-icon",{attrs:{left:""}},[e._v("mdi-play")]),e._v(" 再生 ")],1),n("v-btn",{staticClass:"ml-1",attrs:{outlined:"",color:"error"},on:{click:e.previewStop}},[n("v-icon",{attrs:{left:""}},[e._v("mdi-stop")]),e._v(" 停止 ")],1)],1)],1)],1)],1)])},l=[],u=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{staticClass:"measure",class:{hiddenControl:e.notes.find((function(e){return 95===e.type&&0===e.position}))},style:{bottom:e.measure.measurePositionBottom+"px",height:e.measure.measureHeight+"px"}},[n("v-menu",{attrs:{"offset-y":""},scopedSlots:e._u([{key:"activator",fn:function(t){var o=t.on,i=t.attrs;return[n("v-btn",e._g(e._b({attrs:{dark:"",icon:""}},"v-btn",i,!1),o),[n("v-icon",[e._v("mdi-dots-vertical")])],1)]}}])},[n("v-list",[n("v-list-item",[n("v-list-item-title",[e._v(e._s(e.measure.measure)+" 小節 ( "+e._s(e.notes.size)+" OBJ )")])],1),n("v-list-item",[e._v("到達時間："+e._s(e.measure.measureReachTime)+"ms")]),n("v-list-item",{staticClass:"px-0"},[n("v-btn",{attrs:{color:"error",text:"",disabled:""}},[n("v-icon",{attrs:{left:""}},[e._v("mdi-delete")]),e._v(" ノーツを全削除 ")],1)],1)],1)],1),n("span",{staticClass:"measure__number",domProps:{textContent:e._s(e.measure.measure)}}),e._l(e.notes.filter((function(e){return 2!==e.type})),(function(t,o){return n("Note",{key:"note_"+e.measure.measure+"_"+o,attrs:{note:t,measure:e.measure}})}))],2)},c=[],p=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("v-menu",{attrs:{"close-on-click":!1,"close-on-content-click":!1,absolute:"",left:"","nudge-left":50,"max-width":240},scopedSlots:e._u([{key:"activator",fn:function(t){var o,i=t.on,a=t.attrs;return[n("span",e._g(e._b({staticClass:"note",class:(o={},o["type"+e.note.type]=!0,o.hidden=e.isHiddenControl,o),style:{left:e.positionLeft+"px",bottom:e.positionBottom+"px",width:e.noteWidth+"px"}},"span",a,!1),i),[e._v(" "+e._s(e.note.position)+"/"+e._s(e.note.split)+" "),97===e.note.type?n("strong",[e._v("BEAT "+e._s(e.note.option[0]))]):e._e(),98===e.note.type?n("strong",[e._v("BPM "+e._s(e.note.option[0]))]):e._e(),99===e.note.type?n("strong",[e._v("EOF")]):e._e()])]}}]),model:{value:e.menu,callback:function(t){e.menu=t},expression:"menu"}},[n("v-card",[n("v-list",[n("v-list-item",[n("v-card-text",[e._v("ノートの配置場所")]),n("v-spacer"),n("v-btn",{attrs:{icon:"",right:""},on:{click:function(t){e.menu=!1}}},[n("v-icon",[e._v("mdi-close")])],1)],1),n("v-list-item",[n("v-row",[n("v-col",[n("v-text-field",{attrs:{value:e.note.measure,"hide-details":"",suffix:"小節",outlined:"",dense:"",min:"1",max:"5"},on:{change:function(t){return e.note.measure=Number(t)}}})],1)],1)],1),n("v-list-item",[n("v-row",[n("v-col",{attrs:{cols:"12",sm:"6"}},[n("v-text-field",{attrs:{label:"position",outlined:"",dense:"","hide-details":"",type:"number"},model:{value:e.note.position,callback:function(t){e.$set(e.note,"position",t)},expression:"note.position"}})],1),n("v-col",{attrs:{cols:"12",sm:"6"}},[n("v-text-field",{attrs:{label:"split",outlined:"",dense:"","hide-details":"",type:"number"},model:{value:e.note.split,callback:function(t){e.$set(e.note,"split",t)},expression:"note.split"}})],1)],1)],1),n("v-list-item",[e._v(" LANE "),n("v-spacer"),n("v-radio-group",{attrs:{row:""},model:{value:e.note.lane,callback:function(t){e.$set(e.note,"lane",t)},expression:"note.lane"}},e._l(5,(function(e){return n("v-radio",{key:e,attrs:{value:e}})})),1)],1),n("v-list-item",[n("v-select",{attrs:{items:e.noteTypes,"hide-details":"",label:"ノート種別",align:"left",outlined:"",dense:""},model:{value:e.note.type,callback:function(t){e.$set(e.note,"type",t)},expression:"note.type"}})],1),e.noteOptions(e.note).length>0?n("v-list-item",[n("v-card-text",[e._v("オプション")]),n("v-spacer"),n("v-btn",{attrs:{href:"https://github.com/mtsgi/fumenedit/blob/master/format.md",target:"_blank",icon:"",right:""}},[n("v-icon",[e._v("mdi-help")])],1)],1):e._e(),e._l(e.noteOptions(e.note),(function(t,o){return n("v-list-item",{key:"option_"+o},[n("v-text-field",{attrs:{"hide-details":"",label:t.label,type:t.type,outlined:"",dense:""},model:{value:e.note.option[o],callback:function(t){e.$set(e.note.option,o,t)},expression:"note.option[i]"}})],1)}))],2),n("v-card-actions",[n("v-btn",{attrs:{color:"error",text:""},on:{click:e.deleteThisNote}},[n("v-icon",{attrs:{left:""}},[e._v("mdi-delete")]),e._v(" ノートを削除 ")],1)],1)],1)],1)},d=[],f=(n("caad"),n("ac1f"),n("1276"),{data:function(){return{noteTypes:[{text:"通常",value:1},{text:"ロング",value:2,disabled:!0},{text:"左フリック",value:3},{text:"右フリック",value:4},{text:"音札",value:5,disabled:!0},{text:"区切り線",value:95},{text:"拍子変化",value:97},{text:"BPM変化",value:98},{text:"EOF",value:99}]}},methods:{noteOptions:function(e){return[3,4].includes(e.type)?[{label:"width",type:"number"},{label:"offsetNumer",type:"number"},{label:"offsetDenom",type:"number"}]:95===e.type?[{label:"length",type:"number"}]:97===e.type?[{label:"beat",type:"number"}]:98===e.type?[{label:"bpm",type:"number"}]:[]}}}),m={mixins:[f],data:function(){return{menu:!1}},props:{note:{type:Object,required:!0},measure:{type:Object,required:!0}},methods:{deleteThisNote:function(){this.$root.$children.first.deleteNote(this.note),this.menu=!1}},computed:{positionLeft:function(){if([1,2,95].includes(this.note.type))return 60*(this.note.lane-1);if([3,4].includes(this.note.type)){var e=this.note.option[0]||3;-1===e&&(e=3);var t=60*(this.note.lane-1)+30,n=0;return this.note.option[1]&&this.note.option[2]&&(n=this.note.option[1]/this.note.option[2]*60),t-e/2*60+n}return 0},positionBottom:function(){return this.note.position/this.note.split*this.measure.measureHeight},noteWidth:function(){if([1,2].includes(this.note.type))return 60;if([3,4].includes(this.note.type)){var e=this.note.option[0]||3;return-1===e&&(e=3),60*e}if(95===this.note.type){var t=this.note.option[0]||1;return-1===t&&(t=1),0===this.note.position&&(t=5),60*t}return 300},isHiddenControl:function(){return 95===this.note.type&&0===this.note.position}}},v=m,h=(n("d51b"),n("2877")),b=n("6544"),y=n.n(b),x=n("8336"),g=n("b0af"),_=n("99d9"),w=n("62ad"),O=n("132d"),k=n("8860"),N=n("da13"),j=n("e449"),C=n("67b6"),A=n("43a6"),B=n("0fd9"),V=n("b974"),T=n("2fa4"),D=n("8654"),P=Object(h["a"])(v,p,d,!1,null,"789dc930",null),L=P.exports;y()(P,{VBtn:x["a"],VCard:g["a"],VCardActions:_["a"],VCardText:_["b"],VCol:w["a"],VIcon:O["a"],VList:k["a"],VListItem:N["a"],VMenu:j["a"],VRadio:C["a"],VRadioGroup:A["a"],VRow:B["a"],VSelect:V["a"],VSpacer:T["a"],VTextField:D["a"]});var $={props:{notes:{type:Array,default:function(){return[]}},measure:{type:Object,required:!0},measureData:{type:Array,default:function(){return[]}}},components:{Note:L}},M=$,H=(n("88d8"),n("5d23")),R=Object(h["a"])(M,u,c,!1,null,"038f2094",null),F=R.exports;y()(R,{VBtn:x["a"],VIcon:O["a"],VList:k["a"],VListItem:N["a"],VListItemTitle:H["b"],VMenu:j["a"]});var S=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",[n("span",{staticClass:"note",class:"type"+e.note.type,style:{left:e.getLeft(e.note)+"px",bottom:e.getBottom(e.note)+"px",width:e.getWidth(e.note)+"px"}},[e._v(e._s(e.note.position)+"/"+e._s(e.note.split))]),e._l(e.note.end,(function(t,o){return n("div",{key:o},[n("span",{staticClass:"note",class:"type"+t.type,style:{left:e.getLeft(t)+"px",bottom:e.getBottom(t)+"px",width:e.getWidth(t)+"px"}},[e._v(e._s(e.note.position)+"/"+e._s(e.note.split))]),n("i",{staticClass:"note-hold",style:{bottom:e.getBottom(e.note)+"px",left:e.getLeft(t)+"px",height:e.getBottom(t)-e.getBottom(e.note)+"px"}})])}))],2)},E=[],I={props:{note:{type:Object,required:!0},measureData:{type:Array,required:!0}},methods:{getLeft:function(e){return 60*(e.lane-1)+40},getBottom:function(e){return this.measureData[e.measure].measurePositionBottom+e.position/e.split*this.measureData[e.measure].measureHeight},getWidth:function(){return 60}}},q=I,W=Object(h["a"])(q,S,E,!1,null,"74287ed7",null),z=W.exports,J=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",[n("span",{staticClass:"note",class:"type"+e.note.type,style:{left:e.getAbsoluteLeft(e.note)+"px",bottom:e.getAbsoluteBottom(e.note)+"px",width:e.getWidth(e.note)+"px"}},[e._v(e._s(e.note.position)+"/"+e._s(e.note.split))]),e._l(e.note.end,(function(t,o){return n("div",{key:o},[n("span",{staticClass:"note",class:"type"+t.type,style:{left:e.getAbsoluteLeft(t)+"px",bottom:e.getAbsoluteBottom(t)+"px",width:e.getWidth(t)+"px"}},[e._v(e._s(e.note.position)+"/"+e._s(e.note.split))]),n("i",{staticClass:"note-hold",style:{bottom:e.getAbsoluteBottom(e.note)+"px",left:e.getAbsoluteLeft(t)+"px",height:e.getAbsoluteBottom(t)-e.getAbsoluteBottom(e.note)+"px"}})])}))],2)},U=[],G={props:{note:{type:Object,required:!0},measureData:{type:Array,required:!0}},methods:{getLeft:function(e){if([1,2,95].includes(e.type))return 60*(e.lane-1);if([3,4].includes(e.type)){var t=e.option[0]||3;-1===t&&(t=3);var n=60*(e.lane-1)+30,o=0;return e.option[1]&&e.option[2]&&(o=e.option[1]/e.option[2]*60),n-t/2*60+o}return 0},getAbsoluteLeft:function(e){return this.getLeft(e)+40},getBottom:function(e){var t=this.measureData[e.measure]||this.measureData.last;return e.position/e.split*t.measureHeight},getAbsoluteBottom:function(e){var t=this.measureData[e.measure]||this.measureData.last;return t.measurePositionBottom+e.position/e.split*t.measureHeight},getWidth:function(e){if([1,2].includes(e.type))return 60;if([3,4].includes(e.type)){var t=e.option[0]||3;return-1===t&&(t=3),60*t}if(95===e.type){var n=e.option[0]||1;return-1===n&&(n=1),0===e.position&&(n=5),60*n}return 300}}},K=G,Q=(n("0ebb"),Object(h["a"])(K,J,U,!1,null,"bf0796b6",null)),X=Q.exports,Y={data:function(){return{isPreviewing:!1,currentPosition:0,timeoutIds:[],intervalId:null,startFrom:0,currentMeasure:0,currentBpm:0,currentBeat:0}},props:{currentChart:{type:Array,default:function(){return[]}},measureData:{type:Array,default:function(){return[]}},previewAudio:{type:HTMLAudioElement},infoObject:{type:Object,required:!0},appendNote:{type:Object}},methods:{playFromMeasure:function(){var e=this,t=this.startOffset,n=60/this.infoObject.bpm*this.infoObject.beat*1e3;setTimeout((function(){e.previewAudio.currentTime=t/1e3,e.previewAudio.play()}),n),this.measureData.forEach((function(n,o){var i=e.measureData[o+1]||{};n.measureReachTime>t&&e.timeoutIds.push(setTimeout((function(){e.currentPosition=i.measurePositionBottom;var t=i.measureReachTime-n.measureReachTime;e.$refs.preview.style.transition="".concat(t,"ms all linear"),e.$refs.preview.style.bottom="-".concat(e.currentPosition,"px")}),n.measureReachTime-t))}))},previewStart:function(){this.isPreviewing=!0,this.$refs.preview.style.transition="0ms all linear",this.$refs.preview.style.bottom="-".concat(this.measureData.first.measurePositionBottom,"px"),this.playFromMeasure()},previewStop:function(){this.previewAudio.pause(),this.isPreviewing=!1,this.currentPosition=0,this.currentBpm=0,this.currentBeat=0,this.$refs.preview.style.bottom="0px",this.timeoutIds.forEach((function(e){return clearInterval(e)}))}},computed:{entireHeight:function(){var e,t;return(null===(e=this.measureData.last)||void 0===e?void 0:e.measurePositionBottom)+(null===(t=this.measureData.last)||void 0===t?void 0:t.measureHeight)},startOffset:function(){return this.measureData[this.startFrom].measureReachTime},previewDelay:function(){return 10*this.measureData.size+100}},components:{Measure:F,LongNote:z,NoteShadow:X}},Z=Y,ee=(n("5a0c"),n("cd55")),te=n("49e2"),ne=n("c865"),oe=n("0393"),ie=Object(h["a"])(Z,s,l,!1,null,"4243c7ac",null),ae=ie.exports;y()(ie,{VBtn:x["a"],VExpansionPanel:ee["a"],VExpansionPanelContent:te["a"],VExpansionPanelHeader:ne["a"],VExpansionPanels:oe["a"],VIcon:O["a"],VTextField:D["a"]});var re={name:"App",mixins:[f],data:function(){return{isLoaded:!1,reader:new FileReader,previewAudio:new Audio,fileName:"default-song.json",difficulties:["raku","easy","normal","hard","extra"],currentDifficulty:"easy",chartObject:{raku:[],easy:[],normal:[],hard:[],extra:[],info:{offset:0,bpm:120,beat:4}},appendNote:{type:1,lane:1,measure:1,position:0,split:4,option:[]},isAppendMode:!0,scrollTo:0,beatHeight:100}},beforeCreate:r["a"].init,mounted:function(){var e=this;this.reader.onload=function(t){e.chartObject=JSON.parse(t.target.result),e.isLoaded=!0}},methods:{readFile:function(e){this.fileName=e.name,this.reader.readAsText(e)},newFile:function(){this.fileName="default.json",this.isLoaded=!0},saveFile:function(){var e=this.chartObject,t=new Blob([JSON.stringify(e,null,4)],{type:"application/json"}),n=document.createElement("a");n.href=URL.createObjectURL(t),n.download=this.fileName,document.body.appendChild(n),n.click(),document.body.removeChild(n)},readAudioFile:function(e){this.previewAudio.src=window.URL.createObjectURL(e)},zoomOut:function(){this.beatHeight=this.beatHeight-10||0},zoomIn:function(){this.beatHeight=this.beatHeight+10||100},scrollToMeasure:function(e){var t,n=(null===(t=this.measureData.last)||void 0===t?void 0:t.measurePositionBottom)-this.measureData[e].measurePositionBottom;this.$vuetify.goTo(n)},appendNotes:function(e){var t=this;e.forEach((function(e){var n;null===(n=t.chartObject[t.currentDifficulty])||void 0===n||n.append(JSON.parse(JSON.stringify(e)))}))},appendNoteToLeft:function(){this.appendNote.lane=Math.max(this.appendNote.lane-1,1)},appendNoteToRight:function(){this.appendNote.lane=Math.min(this.appendNote.lane+1,5)},deleteNote:function(e){var t;this.chartObject[this.currentDifficulty]=null===(t=this.chartObject[this.currentDifficulty])||void 0===t?void 0:t.delete(e)}},computed:{currentChart:function(){return this.chartObject[this.currentDifficulty]||[]},musicBpm:function(){return this.chartObject.info.bpm},musicBeat:function(){return this.chartObject.info.beat},musicOffset:function(){return this.chartObject.info.offset},maxMeasure:function(){return this.currentChart.size>0?this.currentChart.max_by((function(e){return e.measure})).measure:1},measureData:function(){var e=this,t=[],n=this.musicBeat,o=this.musicBpm,i=this.musicOffset,a=this.musicOffset/(60/o*1e3)*this.beatHeight;return(this.maxMeasure+1).times((function(r){var s=e.currentChart.find((function(e){return 97===e.type&&e.measure===r})),l=e.currentChart.find((function(e){return 98===e.type&&e.measure===r}));s&&(n=s.option[0]),l&&(o=l.option[0]);var u=e.beatHeight*n;t.push({measure:r,measureBpm:o,measureBeat:n,measureReachTime:i,measurePositionBottom:a,measureHeight:u}),i+=60/o*n*1e3,a+=e.beatHeight*n})),t},getAppendNote:function(){return this.isAppendMode?this.appendNote:null}},components:{Preview:ae}},se=re,le=(n("5c0b"),n("7496")),ue=n("ac7c"),ce=n("a523"),pe=n("23a7"),de=n("ba0d"),fe=Object(h["a"])(se,i,a,!1,null,null,null),me=fe.exports;y()(fe,{VApp:le["a"],VBtn:x["a"],VCheckbox:ue["a"],VCol:w["a"],VContainer:ce["a"],VFileInput:pe["a"],VIcon:O["a"],VRadio:C["a"],VRadioGroup:A["a"],VRow:B["a"],VSelect:V["a"],VSlider:de["a"],VTextField:D["a"]});var ve=n("f309"),he=n("dca6"),be=n.n(he);o["a"].use(ve["a"]);var ye=new ve["a"]({lang:{locales:{ja:be.a},current:"ja"}});o["a"].config.productionTip=!1,new o["a"]({vuetify:ye,render:function(e){return e(me)}}).$mount("#app")},"5a0c":function(e,t,n){"use strict";var o=n("d715"),i=n.n(o);i.a},"5c0b":function(e,t,n){"use strict";var o=n("9c0c"),i=n.n(o);i.a},"5e9b":function(e,t,n){},"88d8":function(e,t,n){"use strict";var o=n("4678"),i=n.n(o);i.a},"9c0c":function(e,t,n){},d51b:function(e,t,n){"use strict";var o=n("f745"),i=n.n(o);i.a},d715:function(e,t,n){},f745:function(e,t,n){}});
//# sourceMappingURL=app.8d68432c.js.map