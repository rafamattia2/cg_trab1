"use strict";

// This is not a full .obj parser.
// see http://paulbourke.net/dataformats/obj/

function parseOBJ(text) {
  // because indices are base 1 let's just fill in the 0th data
  const objPositions = [[0, 0, 0]];
  const objTexcoords = [[0, 0]];
  const objNormals = [[0, 0, 0]];
  const objColors = [[0, 0, 0]];

  // same order as `f` indices
  const objVertexData = [
    objPositions,
    objTexcoords,
    objNormals,
    objColors,
  ];

  // same order as `f` indices
  let webglVertexData = [
    [],   // positions
    [],   // texcoords
    [],   // normals
    [],   // colors
  ];

  const materialLibs = [];
  const geometries = [];
  let geometry;
  let groups = ['default'];
  let material = 'default';
  let object = 'default';

  const noop = () => {};

  function newGeometry() {
    // If there is an existing geometry and it's
    // not empty then start a new one.
    if (geometry && geometry.data.position.length) {
      geometry = undefined;
    }
  }

  function setGeometry() {
    if (!geometry) {
      const position = [];
      const texcoord = [];
      const normal = [];
      const color = [];
      webglVertexData = [
        position,
        texcoord,
        normal,
        color,
      ];
      geometry = {
        object,
        groups,
        material,
        data: {
          position,
          texcoord,
          normal,
          color,
        },
      };
      geometries.push(geometry);
    }
  }

  function addVertex(vert) {
    const ptn = vert.split('/');
    ptn.forEach((objIndexStr, i) => {
      if (!objIndexStr) {
        return;
      }
      const objIndex = parseInt(objIndexStr);
      const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
      webglVertexData[i].push(...objVertexData[i][index]);
      // if this is the position index (index 0) and we parsed
      // vertex colors then copy the vertex colors to the webgl vertex color data
      if (i === 0 && objColors.length > 1) {
        geometry.data.color.push(...objColors[index]);
      }
    });
  }

  const keywords = {
    v(parts) {
      // if there are more than 3 values here they are vertex colors
      if (parts.length > 3) {
        objPositions.push(parts.slice(0, 3).map(parseFloat));
        objColors.push(parts.slice(3).map(parseFloat));
      } else {
        objPositions.push(parts.map(parseFloat));
      }
    },
    vn(parts) {
      objNormals.push(parts.map(parseFloat));
    },
    vt(parts) {
      // should check for missing v and extra w?
      objTexcoords.push(parts.map(parseFloat));
    },
    f(parts) {
      setGeometry();
      const numTriangles = parts.length - 2;
      for (let tri = 0; tri < numTriangles; ++tri) {
        addVertex(parts[0]);
        addVertex(parts[tri + 1]);
        addVertex(parts[tri + 2]);
      }
    },
    s: noop,    // smoothing group
    mtllib(parts) {
      // the spec says there can be multiple file here
      // but I found one with a space in the filename
      materialLibs.push(parts.join(' '));
    },
    usemtl(parts, unparsedArgs) {
      material = unparsedArgs;
      newGeometry();
    },
    g(parts) {
      groups = parts;
      newGeometry();
    },
    o(parts, unparsedArgs) {
      object = unparsedArgs;
      newGeometry();
    },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  // remove any arrays that have no entries.
  for (const geometry of geometries) {
    geometry.data = Object.fromEntries(
        Object.entries(geometry.data).filter(([, array]) => array.length > 0));
  }

  return {
    geometries,
    materialLibs,
  };
}

function parseMapArgs(unparsedArgs) {
  // TODO: handle options
  return unparsedArgs;
}

function parseMTL(text) {
  const materials = {};
  let material;

  const keywords = {
    newmtl(parts, unparsedArgs) {
      material = {};
      materials[unparsedArgs] = material;
    },
    /* eslint brace-style:0 */
    Ns(parts)       { material.shininess      = parseFloat(parts[0]); },
    Ka(parts)       { material.ambient        = parts.map(parseFloat); },
    Kd(parts)       { material.diffuse        = parts.map(parseFloat); },
    Ks(parts)       { material.specular       = parts.map(parseFloat); },
    Ke(parts)       { material.emissive       = parts.map(parseFloat); },
    map_Kd(parts, unparsedArgs)   { material.diffuseMap = parseMapArgs(unparsedArgs); },
    map_Ns(parts, unparsedArgs)   { material.specularMap = parseMapArgs(unparsedArgs); },
    map_Bump(parts, unparsedArgs) { material.normalMap = parseMapArgs(unparsedArgs); },
    Ni(parts)       { material.opticalDensity = parseFloat(parts[0]); },
    d(parts)        { material.opacity        = parseFloat(parts[0]); },
    illum(parts)    { material.illum          = parseInt(parts[0]); },
  };

  const keywordRE = /(\w*)(?: )*(.*)/;
  const lines = text.split('\n');
  for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
    const line = lines[lineNo].trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const m = keywordRE.exec(line);
    if (!m) {
      continue;
    }
    const [, keyword, unparsedArgs] = m;
    const parts = line.split(/\s+/).slice(1);
    const handler = keywords[keyword];
    if (!handler) {
      console.warn('unhandled keyword:', keyword);  // eslint-disable-line no-console
      continue;
    }
    handler(parts, unparsedArgs);
  }

  return materials;
}

function makeIndexIterator(indices) {
  let ndx = 0;
  const fn = () => indices[ndx++];
  fn.reset = () => { ndx = 0; };
  fn.numElements = indices.length;
  return fn;
}

function makeUnindexedIterator(positions) {
  let ndx = 0;
  const fn = () => ndx++;
  fn.reset = () => { ndx = 0; };
  fn.numElements = positions.length / 3;
  return fn;
}

const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

function generateTangents(position, texcoord, indices) {
  const getNextIndex = indices ? makeIndexIterator(indices) : makeUnindexedIterator(position);
  const numFaceVerts = getNextIndex.numElements;
  const numFaces = numFaceVerts / 3;

  const tangents = [];
  for (let i = 0; i < numFaces; ++i) {
    const n1 = getNextIndex();
    const n2 = getNextIndex();
    const n3 = getNextIndex();

    const p1 = position.slice(n1 * 3, n1 * 3 + 3);
    const p2 = position.slice(n2 * 3, n2 * 3 + 3);
    const p3 = position.slice(n3 * 3, n3 * 3 + 3);

    const uv1 = texcoord.slice(n1 * 2, n1 * 2 + 2);
    const uv2 = texcoord.slice(n2 * 2, n2 * 2 + 2);
    const uv3 = texcoord.slice(n3 * 2, n3 * 2 + 2);

    const dp12 = m4.subtractVectors(p2, p1);
    const dp13 = m4.subtractVectors(p3, p1);

    const duv12 = subtractVector2(uv2, uv1);
    const duv13 = subtractVector2(uv3, uv1);


    const f = 1.0 / (duv12[0] * duv13[1] - duv13[0] * duv12[1]);
    const tangent = Number.isFinite(f)
        ? m4.normalize(m4.scaleVector(m4.subtractVectors(
            m4.scaleVector(dp12, duv13[1]),
            m4.scaleVector(dp13, duv12[1]),
        ), f))
        : [1, 0, 0];

    tangents.push(...tangent, ...tangent, ...tangent);
  }

  return tangents;
}

async function main() {
  // Get A WebGL context
  /** @type {HTMLCanvasElement} */
  const canvas = document.querySelector("#canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) {
    return;
  }

  // Tell the twgl to match position with a_position etc..
  twgl.setAttributePrefix("a_");

  const vs = `#version 300 es
  in vec4 a_position;
  in vec3 a_normal;
  in vec3 a_tangent;
  in vec2 a_texcoord;
  in vec4 a_color;

  uniform mat4 u_projection;
  uniform mat4 u_view;
  uniform mat4 u_world;
  uniform vec3 u_viewWorldPosition;

  out vec3 v_normal;
  out vec3 v_tangent;
  out vec3 v_surfaceToView;
  out vec2 v_texcoord;
  out vec4 v_color;

  void main() {
    vec4 worldPosition = u_world * a_position;
    gl_Position = u_projection * u_view * worldPosition;
    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;

    mat3 normalMat = mat3(u_world);
    v_normal = normalize(normalMat * a_normal);
    v_tangent = normalize(normalMat * a_tangent);

    v_texcoord = a_texcoord;
    v_color = a_color;
  }
  `;

  const fs = `#version 300 es
  precision highp float;

  in vec3 v_normal;
  in vec3 v_tangent;
  in vec3 v_surfaceToView;
  in vec2 v_texcoord;
  in vec4 v_color;

  uniform vec3 diffuse;
  uniform sampler2D diffuseMap;
  uniform vec3 ambient;
  uniform vec3 emissive;
  uniform vec3 specular;
  uniform sampler2D specularMap;
  uniform float shininess;
  uniform sampler2D normalMap;
  uniform float opacity;
  uniform vec3 u_lightDirection;
  uniform vec3 u_ambientLight;

  out vec4 outColor;

  void main () {
    vec3 normal = normalize(v_normal) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 tangent = normalize(v_tangent) * ( float( gl_FrontFacing ) * 2.0 - 1.0 );
    vec3 bitangent = normalize(cross(normal, tangent));

    mat3 tbn = mat3(tangent, bitangent, normal);
    normal = texture(normalMap, v_texcoord).rgb * 2. - 1.;
    normal = normalize(tbn * normal);

    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
    vec3 halfVector = normalize(u_lightDirection + surfaceToViewDirection);

    float fakeLight = dot(u_lightDirection, normal) * .5 + .5;
    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);
    vec4 specularMapColor = texture(specularMap, v_texcoord);
    vec3 effectiveSpecular = specular * specularMapColor.rgb;

    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb * v_color.rgb;
    float effectiveOpacity = opacity * diffuseMapColor.a * v_color.a;

    outColor = vec4(
        emissive +
        ambient * u_ambientLight +
        effectiveDiffuse * fakeLight +
        effectiveSpecular * pow(specularLight, shininess),
        effectiveOpacity);
  }
  `;


  // compiles and links the shaders, looks up attribute and uniform locations
  const meshProgramInfo = twgl.createProgramInfo(gl, [vs, fs]);

  // const objHref = 'https://webgl2fundamentals.org/webgl/resources/models/windmill/windmill.obj';
  const objHref = "/objects/rooms/Room1.obj";
  const response = await fetch(objHref);
  const text = await response.text();
  const obj = parseOBJ(text);
  const baseHref = new URL(objHref, window.location.href);
  const mtlHref = "/objects/rooms/Room1.mtl";
  const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
    const matHref = new URL(mtlHref, baseHref).href;
    const response = await fetch(matHref);
    return await response.text();
  }));
  const materials = parseMTL(matTexts.join('\n'));

  const textures = {
    defaultWhite: twgl.createTexture(gl, {src: [255, 255, 255, 255]}),
    defaultNormal: twgl.createTexture(gl, {src: [127, 127, 255, 0]}),
  };

  // load texture for materials
  for (const material of Object.values(materials)) {
    Object.entries(material)
        .filter(([key]) => key.endsWith('Map'))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            const textureHref = new URL(filename, baseHref).href;
            texture = twgl.createTexture(gl, {src: textureHref, flipY: true});
            textures[filename] = texture;
          }
          material[key] = texture;
        });
  }

  const secondObjHref = "/objects/jet/jet.obj";
  const secondResponse = await fetch(secondObjHref);
  const secondText = await secondResponse.text();
  const secondObj = parseOBJ(secondText);
  const secondBaseHref = new URL(secondObjHref, window.location.href);
  const secondMtlHref = "/objects/jet/jet.mtl";
  const secondMatTexts = await Promise.all(
      secondObj.materialLibs.map(async filename => {
        const matHref = new URL(secondMtlHref, secondBaseHref).href;
        const response = await fetch(matHref);
        return await response.text();
  }));

  const secondMaterials = parseMTL(secondMatTexts.join('\n'));

  // load texture for materials
  for (const material of Object.values(secondMaterials)) {
    Object.entries(material)
        .filter(([key]) => key.endsWith('Map'))
        .forEach(([key, filename]) => {
          let texture = textures[filename];
          if (!texture) {
            const textureHref = new URL(filename, secondBaseHref).href;
            texture = twgl.createTexture(gl, {src: textureHref, flipY: true});
            textures[filename] = texture;
          }
          material[key] = texture;
        });
  }

  // hack the materials so we can see the specular map
  Object.values(materials).forEach(m => {
    m.shininess = 25;
    m.specular = [1, 1, 1];
  });

  const defaultMaterial = {
    diffuse: [1, 1, 1],
    diffuseMap: textures.defaultWhite,
    normalMap: textures.defaultNormal,
    ambient: [0, 0, 0],
    specular: [1, 1, 1],
    specularMap: textures.defaultWhite,
    shininess: 5,
    opacity: 1,
  };

  const parts = obj.geometries.map(({material, data}) => {
    // Because data is just named arrays like this
    //
    // {
    //   position: [...],
    //   texcoord: [...],
    //   normal: [...],
    // }
    //
    // and because those names match the attributes in our vertex
    // shader we can pass it directly into `createBufferInfoFromArrays`
    // from the article "less code more fun".

    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // generate tangents if we have the data to do so.
    if (data.texcoord && data.normal) {
      data.tangent = generateTangents(data.position, data.texcoord);
    } else {
      // There are no tangents
      data.tangent = { value: [1, 0, 0] };
    }

    if (!data.texcoord) {
      data.texcoord = { value: [0, 0] };
    }

    if (!data.normal) {
      // we probably want to generate normals if there are none
      data.normal = { value: [0, 0, 1] };
    }

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
    return {
      material: {
        ...defaultMaterial,
        ...materials[material],
      },
      bufferInfo,
      vao,
    };
  });


  const secondParts = secondObj.geometries.map(({material, data}) => {
    // Because data is just named arrays like this
    //
    // {
    //   position: [...],
    //   texcoord: [...],
    //   normal: [...],
    // }
    //
    // and because those names match the attributes in our vertex
    // shader we can pass it directly into `createBufferInfoFromArrays`
    // from the article "less code more fun".

    if (data.color) {
      if (data.position.length === data.color.length) {
        // it's 3. The our helper library assumes 4 so we need
        // to tell it there are only 3.
        data.color = { numComponents: 3, data: data.color };
      }
    } else {
      // there are no vertex colors so just use constant white
      data.color = { value: [1, 1, 1, 1] };
    }

    // generate tangents if we have the data to do so.
    if (data.texcoord && data.normal) {
      data.tangent = generateTangents(data.position, data.texcoord);
    } else {
      // There are no tangents
      data.tangent = { value: [1, 0, 0] };
    }

    if (!data.texcoord) {
      data.texcoord = { value: [0, 0] };
    }

    if (!data.normal) {
      // we probably want to generate normals if there are none
      data.normal = { value: [0, 0, 1] };
    }

    // create a buffer for each array by calling
    // gl.createBuffer, gl.bindBuffer, gl.bufferData
    const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
    const vao = twgl.createVAOFromBufferInfo(gl, meshProgramInfo, bufferInfo);
    return {
      material: {
        ...defaultMaterial,
        ...secondMaterials[material],
      },
      bufferInfo,
      vao,
    };
  });

  function getExtents(positions) {
    const min = positions.slice(0, 3);
    const max = positions.slice(0, 3);
    for (let i = 3; i < positions.length; i += 3) {
      for (let j = 0; j < 3; ++j) {
        const v = positions[i + j];
        min[j] = Math.min(v, min[j]);
        max[j] = Math.max(v, max[j]);
      }
    }
    return {min, max};
  }

  function getGeometriesExtents(geometries) {
    return geometries.reduce(({min, max}, {data}) => {
      const minMax = getExtents(data.position);
      return {
        min: min.map((min, ndx) => Math.min(minMax.min[ndx], min)),
        max: max.map((max, ndx) => Math.max(minMax.max[ndx], max)),
      };
    }, {
      min: Array(3).fill(Number.POSITIVE_INFINITY),
      max: Array(3).fill(Number.NEGATIVE_INFINITY),
    });
  }

  const extents = getGeometriesExtents(obj.geometries);
  const range = m4.subtractVectors(extents.max, extents.min);
  // amount to move the object so its center is at the origin
  const objOffset = m4.scaleVector(
      m4.addVectors(
          extents.min,
          m4.scaleVector(range, 0.5)),
      -1);
  const cameraTarget = [0, 0, 0];
  // figure out how far away to move the camera so we can likely
  // see the object.
  const radius = m4.length(range) * 0.5;
  const cameraPosition = m4.addVectors(cameraTarget, [
    0,
    0,
    radius,
  ]);
  // Set zNear and zFar to something hopefully appropriate
  // for the size of this object.
  // const zNear = radius / 100;
  const zNear = 0.001;
  const zFar = 10000;

  function degToRad(deg) {
    return deg * Math.PI / 180;
  }

  ////////// NEW /////////// NEW /////////// NEW /////////// NEW /////////// NEW /////////// NEW ///////////
  var slidersBuffer = {x : 0, y: 0, z: 0, w: 0};

  // XZY NO BLENDER
  var vxs = {
    A: [0, 0.7, 7],
    B: [0.4, 1.3, 1.2],
    C: [3.2, 0.4, 1.2],
    D: [3.4, -1.3, -1.3],
    E: [3.6 , -3, -3.8],
    F: [3.27, 0.91, -2.74],
    G: [1.03, -0.15, -3.02],
    H: [-1.21, -1.21, -3.3],
    I: [-2, -3.5, -0.77894],
    J: [-3, -1.8, -3],
    K: [-4, -0.1, -5.22106],
    L: [-1.79528, 15.4649, 15.0546],
    M: [-0.610376, 6.00695, 4.75389],

  };

  var vxsCurves = {
    firstCurve : [vxs.A, vxs.B, vxs.C, vxs.D],
    secondCurve : [vxs.D, vxs.E, vxs.F, vxs.G],
    thirdCurve : [vxs.G, vxs.H, vxs.I, vxs.J],
    fourthCurve : [vxs.J, vxs.K, vxs.L, vxs.M]
  };
  //Funções para vetores bidimensionais ////////////////////////////////
  // function calculateIntermediateVertex(v1, v2, sliderValue) {
  //   // console.log("v1: " + v1 + " v2: " + v2 + " Slider Value: " + sliderValue);
  //   // const x = v1.x + (sliderValue+1) * (v2.x - v1.x);
  //   // const y = v1.y + (sliderValue+1) * (v2.y - v1.y);
  //   const v1v2t = {
  //     x: v1[0] + (sliderValue*0.01) * (v2[0] - v1[0]),
  //     y: v1[1] + (sliderValue*0.01) * (v2[1] - v1[1])
  //   };
  //   // console.log("Resultado: " + v1v2t.x +" "+ v1v2t.y)
  //   let arr =[v1v2t.x, v1v2t.y]
  //   // let arr =[x, y]
  //   // console.log("arr:" + arr);
  //   return arr;
  // }
  //
  // function calculateIntermediateInArray(currentArray){
  //   let arrayBuffer = []
  //   //Calcula a posição da câmera na curva
  //   if (currentArray.length !== 1){
  //     for (let i = 0; i < currentArray.length-1; i++){
  //       // console.log("testeee: "+currentArray[i] + currentArray[i+1]) ||| ATÉ AQUI TA CERTO ( a principio kakakak)
  //       let intermediateVertex = calculateIntermediateVertex(currentArray[i], currentArray[i+1], slidersBuffer.w);
  //       // console.log("Intermediário: " + intermediateVertex);
  //       arrayBuffer.push(intermediateVertex);
  //     }
  //     return calculateIntermediateInArray(arrayBuffer);
  //   }else{
  //     //console.log(currentArray);
  //     return currentArray;
  //   }
  // }

  //Funções para vetores tridimensionais ////////////////////////////////
  function calculateIntermediateVertex(v1, v2, t) {   //calcula o centro entre dois vetores, dado um parâmetro t
    if(t === 1){
      t = 0.999;
    }

    const v1v2t = [
      v1[0] + t * (v2[0] - v1[0]),
      v1[1] + t * (v2[1] - v1[1]),
      v1[2] + t * (v2[2] - v1[2])
    ];
    return v1v2t;
  }

  function calculateIntermediateInArray(currentArray, t, tg) { // Calcula os novos vetores
    let arrayBuffer = [];
    if (currentArray.length !== 1) {
      for (let i = 0; i < currentArray.length - 1; i++) {
        tg = currentArray[i+1];                                         // A tangente é um dos vetores utilizados para calcular o ponto médio entre dois vetores
        let intermediateVertex = calculateIntermediateVertex(
            currentArray[i],
            currentArray[i + 1],
            t*4
        );
        arrayBuffer.push(intermediateVertex);
      }
      return calculateIntermediateInArray(arrayBuffer, t, tg);
    } else {
      return {currentArray, tg};
    }
  }

  function calculateEachCurve(){
    let value = slidersBuffer.w;
    let result = [];
    if (value <= 0.25){
      result = calculateIntermediateInArray(vxsCurves.firstCurve, slidersBuffer.w);
    }else if(value > 0.25 && value <=0.5){
      result = calculateIntermediateInArray(vxsCurves.secondCurve, slidersBuffer.w-0.25);
    }else if(value > 0.5 && value <=0.75){
      result = calculateIntermediateInArray(vxsCurves.thirdCurve, slidersBuffer.w-0.5);
    }else{
      result = calculateIntermediateInArray(vxsCurves.fourthCurve, slidersBuffer.w-0.75);
    }
    return result;
  }

  var trans = [0, 0];
  function updatePosition(index) {
    return function(event, ui) {
      trans[index] = ui.value;
      // drawScene();
    };
  }
  webglLessonsUI.setupSlider("#x", {slide: updatePosition(0), min: -100, max: 100});
  webglLessonsUI.setupSlider("#y", {slide: updatePosition(1), min: -100, max: 100});
  webglLessonsUI.setupSlider("#z", {slide: updatePosition(2), min: -100, max: 100});
  // webglLessonsUI.setupSlider("#w", {slide: updatePosition(3), max: 400});
  webglLessonsUI.setupSlider("#w", {slide: updatePosition(3), max: 1, step: 0.001, precision: 4});
  webglLessonsUI.setupSlider("#r", {slide: updatePosition(4), max: 100});

  let secondObjectTime = 0;

  function render(time) {
    time *= 0.001;  // convert to seconds

    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.DEPTH_TEST);

    const fieldOfViewRadians = degToRad(60);
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projection = m4.perspective(fieldOfViewRadians, aspect, zNear, zFar);

    // var bezierCurve = calculateIntermediateInArray(vxsCurves.firstCurve);
    var bezierCurve = calculateEachCurve();
    let cameraPosition = bezierCurve.currentArray;
    let cameraPositionTest = [cameraPosition[0][0]+(10*slidersBuffer.x), cameraPosition[0][1]+(10*slidersBuffer.y),cameraPosition[0][2]+(10*slidersBuffer.z)];
    let cameraTg = bezierCurve.tg;
    let cameraTgTest = [cameraPositionTest[0], cameraPositionTest[1], cameraPositionTest[2]+1]
    const up = [0, 1, 0];
    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition[0], cameraTg, up);
    // Make a view matrix from the camera matrix.
    const view = m4.inverse(camera);

    const sharedUniforms = {
      u_lightDirection: m4.normalize([-1, 3, 5]),
      u_view: view,
      u_projection: projection,
      u_viewWorldPosition: cameraPosition,
    };

    slidersBuffer.x = document.querySelector('#x .gman-widget-value').textContent;
    slidersBuffer.y = document.querySelector('#y .gman-widget-value').textContent;
    slidersBuffer.z = document.querySelector('#z .gman-widget-value').textContent;
    slidersBuffer.w = document.querySelector('#w .gman-widget-value').textContent;
    slidersBuffer.r = document.querySelector('#r .gman-widget-value').textContent;

    gl.useProgram(meshProgramInfo.program);

    // calls gl.uniform
    twgl.setUniforms(meshProgramInfo, sharedUniforms);


    // compute the world matrix once since all parts
    // are at the same space.
    let u_world = m4.yRotation((slidersBuffer.r)/360);
    u_world = m4.translate(u_world, ...objOffset);

    for (const {bufferInfo, vao, material} of parts) {
      // set the attributes for this part.
      gl.bindVertexArray(vao);
      // calls gl.uniform
      twgl.setUniforms(meshProgramInfo, {
        u_world,
      }, material);
      // calls gl.drawArrays or gl.drawElements
      twgl.drawBufferInfo(gl, bufferInfo);''
    }

    secondObjectTime += 0.01;

    // RENDERIZA O SEGUNDO OBJETO
    for (const { bufferInfo, vao, material } of secondParts) {
      const scaledUWorld = m4.scale(u_world, 0.005, 0.005, 0.005);
      const xOffset = Math.sin(secondObjectTime) * 1000 * slidersBuffer.w;
      const initialX = -130; // Coloque um valor aqui para ajustar a posição ao longo do eixo X
      const initialY = 2000; // Coloque um valor aqui para ajustar a posição ao longo do eixo Y
      // const initialZ = 0; // Coloque um valor aqui para ajustar a posição ao longo do eixo Z

      const translatedUWorld = m4.translate(scaledUWorld, initialX, initialY, xOffset);
      gl.bindVertexArray(vao);
      twgl.setUniforms(
          meshProgramInfo,
          {
            u_world: translatedUWorld,
          },
          material
      );
      twgl.drawBufferInfo(gl, bufferInfo);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();