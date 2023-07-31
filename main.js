import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Tarvittavat muuttujat
let scene, camera, renderer, player, target;

// NOTICE: Lisätty alustukset.
const playerMoveTarget = new THREE.Vector3();
const playerLookTarget = new THREE.Vector3();
const playerLookTargetNow = new THREE.Vector3();
const targetNextPosition = new THREE.Vector3();

// NOTICE: Lisätty vakioiksi huonekorkeus ja silmien korkeus.
const roomHeight = 2.4;
const lightLevel = 2.2;
const eyeLevel = 0.7;

// Ottaa vastaan kartan tekstinä ja muuttaa sen 2-ulotteiseksi taulukoksi.
function loadMap(mapText) {
  // Jaa kartan tekstimuoto rivitaulukoksi
  const mapRows = mapText.trim().split('\n');

  // Luo 2-ulotteinen taulukko karttaa varten
  const mapArray = [];

  // Käy läpi jokainen rivi ja jaa rivit merkkien taulukoksi
  for (let i = 0; i < mapRows.length; i++) {
    const row = mapRows[i].trim();
    const rowArray = row.split('');

    // Lisää rivi taulukkoon
    mapArray.push(rowArray);
  }

  // NOTICE: Varmistetaan, että rivit ovat yhtä pitkät.
  const l = Math.max(...mapArray.map(x => x.length));
  mapArray.forEach(r => { while (r.length < l) r.push("#"); });

  return mapArray;
}

// Pelialueen kartta
// NOTICE: Vaihdettu vakiot muuttujiksi ja alustetaan vasta init-funktiossa.
let map, mapArray, mapW, mapH;

// Viestin näyttö.
function showText(start, time, text) {
  // Asetetaan ajanotto näytölle 'start' sekunnin kuluttua
  setTimeout(() => {
    // NOTICE: Siirretty elementin luonti yläpuolelta tähän.
    // Luodaan uusi div-elementti, joka sisältää tekstin
    const textElement = document.createElement('div');
    textElement.textContent = text;
    textElement.classList.add('popup-text');

    // Lisätään tekstielementti popupContainer-diviin
    const popupContainer = document.body; // NOTICE: Vaihdettu tähän elementiksi body.
    popupContainer.appendChild(textElement);

    // Asetetaan ajanotto poistamaan tekstielementti 'time' sekunnin kuluttua
    setTimeout(() => {
      popupContainer.removeChild(textElement);
    }, time * 1000);
  }, start * 1000);
}

// Luo valot kaikkiin v-kirjaimilla merkittyihin ruutuihin.
function addLights(mapArray) {
  const lightIntensity = 1.5;
  const lightDistance = 5;

  // Käy läpi kartan taulukko ja lisää valot v-kirjaimen kohdalle
  for (let z = 0; z < mapArray.length; z++) {
    for (let x = 0; x < mapArray[z].length; x++) {
      if (mapArray[z][x] === 'v') {
        // NOTICE: Säädetty valojen väriä ja korkeutta ja koordinaatteja.
        const light = new THREE.PointLight(0xffffdd, lightIntensity, lightDistance);
        light.position.set(x + 0.5, lightLevel, z + 0.5);
        light.castShadow = true;
        scene.add(light);
      }
    }
  }
}

// Satunnaista tekstuuria.
function createNoiseTexture(n, w0, h0, rotation) {
  const size = 4 * n * n;
  const data = new Uint8Array(size);

  for (let i = 0; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256); // Satunnainen arvo välillä 0-255
  }
  const texture = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
  texture.needsUpdate = true; // NOTICE: Lisätty puuttuva rivi, jotta tekstuuri latautuu.
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(w0, h0);

  if (rotation) {
    texture.center.set(0.5, 0.5);
    texture.rotation = rotation;
  }

  return texture;
}

// Koordinaatit (0-1) värikoodiksi.
function getColor(x, y) {
  const colorTL = new THREE.Color("#ff8080"); // Vasen yläkulma
  const colorTR = new THREE.Color("#ffff80"); // Oikea yläkulma
  const colorBL = new THREE.Color("#8080ff"); // Vasen alakulma
  const colorBR = new THREE.Color("#80ff80"); // Oikea alakulma, NOTICE: Vaihdettu värien järjestystä.

  const colorTop = new THREE.Color().lerpColors(colorTL, colorTR, x); // Yläreunan väri
  const colorBottom = new THREE.Color().lerpColors(colorBL, colorBR, x); // Alareunan väri
  const colorFinal = new THREE.Color().lerpColors(colorTop, colorBottom, y); // Lopullinen väri

  return colorFinal;
}

// Reagoidaan ikkunan koon muuttumiseen
function onWindowResize() {
  // Päivitä näkökenttä näkökulma
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Päivitä renderöijän näkymän koko
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Tyhjennä lippu ikkunan koon muuttuessa
  decreaseFlag = false;
}

// Päivitä shadowMap manuaalisesti haluamissasi tilanteissa
function updateShadowMap() {
  renderer.shadowMap.needsUpdate = true;
}

// NOTICE: Laitettu mapText parametriksi ja siirretty vastaavat alustukset funktion sisään.
function init(mapText) {
  map = mapArray = loadMap(mapText);
  mapW = mapArray[0].length;
  mapH = mapArray.length;

  // Luodaan kolmiulotteinen näkymä
  scene = new THREE.Scene();

  // Antaa tasaisen himmeän valaistuksen koko sceneen.
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  // NOTICE: Myös vähän valoa suoraan ylhäältä.
  scene.add(new THREE.DirectionalLight(0xffffff, 0.2));

  // Kamera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.001, mapW + mapH); // NOTICE: Säädetty etäisyyksiä.
  camera.lookAt(0, 0, 1); // NOTICE: Oikea katselusuunta.

  // Renderer
  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(1 / 16); // NOTICE: Vaihdettu 1/16. Parannetaan laatua myöhemmin FPS:n mukaan.
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true; // Varjot käyttöön.
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Voit valita varjojen tarkan tyypin tarpeen mukaan

  // Aseta shadowMapin automaattinen päivitys pois päältä
  renderer.shadowMap.autoUpdate = false;
  updateShadowMap();

  document.body.innerHTML = ""; // NOTICE: Tyhjennetään sivulta muu sisältö, kun peli alkaa.
  document.body.appendChild(renderer.domElement);

  // Kuuntele ikkunan resize-tapahtumaa ja kutsu onWindowResize-funktiota
  window.addEventListener('resize', onWindowResize, false);

  // Pelaaja (kameraa vastaava näkymä)
  player = new THREE.Group();
  player.add(camera);
  scene.add(player);

  // Lattia
  const floorGeometry = new THREE.PlaneGeometry(mapW, mapH);
  // NOTICE: Lisätty materiaaliin bumpMap ja roughnessMap.
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x964B00,
    roughnessMap: createNoiseTexture(64, mapW, mapH, 3.14 * 1/7),
    bumpMap: createNoiseTexture(256, mapW, mapH),
    bumpScale: 0.0003
  });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2; // Aseta lattia vaakasuoraan tasoon (y=0)
  floorMesh.position.set(mapW / 2, 0.01, mapH / 2); // NOTICE: Korjattu sijainti.
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // NOTICE: Lisätty katto samoin kuin lattia mutta huonekorkeuden mukaan.
  // NOTICE: Lisätty materiaaliin bumpMap, vaihdettu väri, vaihdettu luokka.
  const ceilingMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    bumpMap: createNoiseTexture(256, mapW, mapH),
    bumpScale: 0.001
  });
  const ceilingMesh = new THREE.Mesh(floorGeometry, ceilingMaterial);
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(mapW / 2, roomHeight - 0.01, mapH / 2);
  ceilingMesh.receiveShadow = true;
  scene.add(ceilingMesh);

  // Seinät
  for (let i = 0; i < map.length; i++) {
    for (let j = 0; j < map[i].length; j++) {
      if (map[i][j] === "#") {
        // NOTICE: Lisätty pieni vaihtelu seinäpalikoiden kokoon.
        const xor = ((i ^ j) & 1) * 0.05;
        const wallGeometry = new THREE.BoxGeometry(1 + xor, roomHeight + 0.2, 1 + xor);
        // NOTICE: Lisätty materiaaliin bumpMap, vaihdettu väri, vaihdettu luokka.
        const wallMaterial = new THREE.MeshLambertMaterial({
          color: getColor(j / mapW, i / mapH),
          bumpMap: createNoiseTexture(256, 1 * 2, roomHeight * 2),
          bumpScale: 0.0003
        });
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        // NOTICE: Korjattu koordinaatit.
        wall.position.set(j + 0.5, roomHeight / 2, i + 0.5);
        wall.receiveShadow = true;
        wall.castShadow = true; // NOTICE: Lisätty puuttuva rivi varjostusta varten.
        scene.add(wall);
      }
    }
  }

  // Kohde
  // NOTICE: Luotu oma materiaali, jossa on bumpMap ja harmaa väri.
  const targetMaterial = new THREE.MeshLambertMaterial({
    color: 0xeeeeee,
    bumpMap: createNoiseTexture(256, 3, 1),
    bumpScale: 0.001
  });

  // NOTICE: Poistettu "THREE.", jotta luokka löytyy.
  const loader = new GLTFLoader();

  // Luodaan tyhjä THREE.Group, jotta lataus ei estä pelin toimintaa
  // NOTICE: Poistettu const-sana.
  target = new THREE.Group();

  // Lataa malli tiedostosta
  loader.load(
    "target.glb",
    (gltf) => {
      // Lisää ladattu malli ryhmään
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          // Aseta meshille targetMaterial
          child.material = targetMaterial;

          // Aseta varjosäädöt
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Lisää ladattu malli target-ryhmään
      target.add(gltf.scene);
    },
    undefined,
    (error) => {
      console.error('Mallin lataaminen epäonnistui:', error);
    }
  );

  scene.add(target);

  // NOTICE: Siirretty alustuskoodeja tänne ennen animoinnin aloitusta.
  addLights(mapArray);
  initPlayer();
  startGame();

  // Aloita renderöinti
  animate();
}

// Tarkistaa, onko annetussa kohdassa (x, z) seinää mapArray-taulukossa.
function isWall(x, z) {
  // Tarkista ensin, onko koordinaatit taulukon ulkopuolella
  if (x < 0 || z < 0 || z >= mapArray.length || x >= mapArray[0].length) {
    return true;
  }

  // Tarkista, onko koordinaatissa seinä ('#')
  // NOTICE: Lisätty |0 eli muunnos kokonaisluvuiksi.
  const tile = mapArray[z | 0][x | 0];
  return tile === '#';
}

function updatePlayerTarget(targetPosition) {
  // Kopioi targetPosition pelaajan liikesijainniksi (playerMoveTarget)
  playerMoveTarget.copy(targetPosition);
  playerMoveTarget.y = player.position.y; // Aseta sama y-taso kuin pelaajalla

  // Kopioi targetPosition pelaajan katselusijainniksi (playerLookTarget)
  playerLookTarget.copy(targetPosition);

  // Tarkista, onko playerLookTarget yli 2 yksikön päässä pelaajasta
  const distanceToLookTarget = player.position.distanceTo(playerLookTarget);
  if (distanceToLookTarget > 2) {
    // Aseta playerLookTargetin y-koordinaatiksi pelaajan y-koordinaatti
    playerLookTarget.y = player.position.y;
  }

  // Rajoita y-ero enintään 0.2 yksikköön pelaajan sijaintiin verrattuna
  const yDifference = playerLookTarget.y - player.position.y;
  if (Math.abs(yDifference) > 0.2) {
    playerLookTarget.y = player.position.y + (yDifference > 0 ? 0.2 : -0.2);
  }

  // Rajoita playerMoveTargetin etäisyys enintään 5 yksikköön pelaajasta
  const distanceToMoveTarget = player.position.distanceTo(playerMoveTarget);
  if (distanceToMoveTarget > 5) {
    const moveDirection = new THREE.Vector3();
    moveDirection.subVectors(playerMoveTarget, player.position);
    moveDirection.normalize();
    playerMoveTarget.copy(player.position).addScaledVector(moveDirection, 5);
  }
}

// Alusta muuttujat kuluneen ajan laskemista varten
let lastTime = 0;
// NOTICE: Säädetty nopeuksia.
const playerMoveSpeed = 1.5;
const playerLookTime = 1 / 8;
const targetMoveSpeed = 4.0;

function updatePosition() {
  // Laske kulunut aika edellisen kutsun ja nykyisen kutsun välillä
  const currentTime = performance.now(); // Käytä performance.now() tarkkaan ajanmittaukseen
  const deltaTime = (currentTime - lastTime) * 0.001; // Muunna millisekunnit sekunneiksi
  lastTime = currentTime;

  // NOTICE: Rajoitettu yhden framen pituutta, jotta peli ei sekoa huonon FPS:n takia esim. kännykällä.
  for (let t = Math.min(deltaTime, 1); t > 0; t -= 1/20) {
    updatePositionDT(Math.min(deltaTime, 1/20));
  }

  // NOTICE: Lisätty tämä:
  updatePixelRatio(deltaTime);
}

function updatePositionDT(deltaTime) {
  // Laske suuntavektorit pelaajan liikkeelle ja katselulle
  const moveDirection = new THREE.Vector3();
  moveDirection.subVectors(playerMoveTarget, player.position);
  moveDirection.normalize();

  const lookDirection = new THREE.Vector3();
  lookDirection.subVectors(playerLookTarget, playerLookTargetNow);
  // NOTICE: Poistettu normalisointi, koska katseen kääntö saa tapahtua määräajassa alusta loppuun asti.
  playerLookTargetNow.addScaledVector(lookDirection, deltaTime / playerLookTime);

  // Päivitä pelaajan sijainti kuluneen ajan mukaan
  const moveDistance = playerMoveSpeed * deltaTime;
  // NOTICE: Lisätty laskelma, jolla jätetään 0.5 etäisyys kohteeseen.
  const moveDistanceFinal = Math.max(0, Math.min(moveDistance, player.position.distanceTo(playerMoveTarget) - 0.5));
  player.position.addScaledVector(moveDirection, moveDistanceFinal);

  // Käännetään pelaaja katsomaan sijaintiin playerLookTargetNow päin
  player.lookAt(playerLookTargetNow);

  // Viedään kohde uudelle paikalleen.
  // function updateTargetPosition(target, targetNextPosition, targetMoveSpeed, deltaTime)
  const distanceToNextPosition = target.position.distanceTo(targetNextPosition);

  if (distanceToNextPosition > 0.1) {
    const direction = targetNextPosition.clone().sub(target.position).normalize();
    const moveDistance = targetMoveSpeed * deltaTime;
    const moveDistanceFinal = Math.min(distanceToNextPosition, moveDistance); // NOTICE: Lisätty tarkastus, ettei mene kohteen ohi.
    const newPosition = target.position.clone().add(direction.multiplyScalar(moveDistanceFinal));

    target.position.copy(newPosition);
    target.lookAt(targetNextPosition); // NOTICE: Lisätty katseen kääntö menosuuntaan.

    // NOTICE: Lisätty optimointi: päivitetään varjot vain, kun kohde on päässyt perille.
    if (target.position.distanceTo(targetNextPosition) <= 0.1) {
      updateShadowMap();
    }
  }

  // Laske etäisyys pelaajasta kohteeseen
  const distanceToTarget = player.position.distanceTo(targetNextPosition);

  // Tarkista, onko pelaajan etäisyys kohteesta alle 1
  if (distanceToTarget < 1) {
    // Siirrä kohde uuteen paikkaan
    relocateTarget();

    // Näytä teksti "Etsi taas!" 3 sekunnin ajan
    showText(0, 3, "Etsi taas!");
  }
}

// Alusta muuttuja raycaster ja hiirenpiste
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Lisää klikkaustapahtumankäsittelijä dokumentille
document.addEventListener('click', onClick, false);

function onClick(event) {
  // Laske hiiren sijainti suhteessa pelialueeseen
  const canvasBounds = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
  mouse.y = -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;

  // Aseta raycasterin alkupiste hiirenpisteeseen
  raycaster.setFromCamera(mouse, camera);

  // Etsi osumia kartan objekteihin
  const intersects = raycaster.intersectObjects(scene.children);

  // Tarkista osumat
  if (intersects.length > 0) {
    // Laske suunta pelaajan sijainnosta klikattuun pisteeseen
    const targetPosition = intersects[0].point;
    updatePlayerTarget(targetPosition);
  }
}

// Alusta taulukko tallentamaan viimeisimmät 16 fps:tä
const fpsArray = [];

function updatePixelRatio(deltaTime) {
  // Laske fps ajan perusteella
  const fps = 1 / deltaTime;

  // Lisää uusi fps taulukkoon
  fpsArray.push(fps);

  // Jos taulukossa on alle 16 lukua, palaa
  if (fpsArray.length < 16) {
    return;
  }

  // Hae pienin ja suurin fps taulukosta
  const minFPS = Math.min(...fpsArray);
  const maxFPS = Math.max(...fpsArray);

  // Tyhjennä taulukko
  fpsArray.length = 0;

  // Jos pienin on yli 55, kutsu increasePixelRatio-funktiota
  if (minFPS > 55) {
    increasePixelRatio();
  }

  // Jos suurin on alle 30, kutsu decreasePixelRatio-funktiota
  if (maxFPS < 30) {
    decreasePixelRatio();
  }
}

// Taulukko pixel ratio -vaihtoehdoista
const pixelRatioOptions = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2, 1 / 1.5, 1, 1.5, 2, 3, 4];

// Lipun asetus, jos arvoa joudutaan laskemaan
let decreaseFlag = false;

function increasePixelRatio() {
  // Etsi nykyistä pixel ratio -arvoa suurempi vaihtoehto
  const currentPixelRatio = renderer.getPixelRatio();
  let newPixelRatio = currentPixelRatio;
  for (let i = 0; i < pixelRatioOptions.length; i++) {
    if (pixelRatioOptions[i] > currentPixelRatio) {
      newPixelRatio = pixelRatioOptions[i];
      break;
    }
  }

  // Jos löytyi suurempi vaihtoehto ja lippua ei ole asetettu, päivitä pixel ratio
  if (newPixelRatio !== currentPixelRatio && !decreaseFlag) {
    renderer.setPixelRatio(newPixelRatio);
  }
}

function decreasePixelRatio() {
  // Etsi nykyistä pixel ratio -arvoa pienempi vaihtoehto
  const currentPixelRatio = renderer.getPixelRatio();
  let newPixelRatio = currentPixelRatio;
  for (let i = pixelRatioOptions.length - 1; i >= 0; i--) {
    if (pixelRatioOptions[i] < currentPixelRatio) {
      newPixelRatio = pixelRatioOptions[i];
      break;
    }
  }

  // Jos löytyi pienempi vaihtoehto, päivitä pixel ratio ja aseta lippu
  if (newPixelRatio !== currentPixelRatio) {
    renderer.setPixelRatio(newPixelRatio);
    decreaseFlag = true;
  }
}

// Kuuntele numeronäppäimistön painalluksia
document.addEventListener('keypress', (event) => {
  const key = event.key;
  const numericValue = parseInt(key);

  // Tarkista, että painallus oli numeronäppäimistöstä ja että arvo on välillä 1–8
  if (!isNaN(numericValue) && numericValue >= 1 && numericValue <= 8) {
    // Aseta pixelRatio uudeksi arvoksi
    const newPixelRatio = window.devicePixelRatio * 2 / numericValue;
    renderer.setPixelRatio(newPixelRatio);
    console.log('Uusi pixelRatio:', newPixelRatio);
  }
});

function animate() {
  updatePosition();
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Etsii mapArray-taulukosta kaikki koordinaatit, joissa ei ole seinää, mutta joiden ympärillä on seinää vähintään kahdessa ruudussa neljästä.
function findOpenCoordinatesWithSurroundingWalls() {
  const openCoordinates = [];

  // Käy läpi kaikki taulukon rivit ja sarakkeet
  for (let z = 0; z < mapArray.length; z++) {
    for (let x = 0; x < mapArray[0].length; x++) {
      // Tarkista, että taulukossa ei ole seinää kyseisessä koordinaatissa
      if (mapArray[z][x] !== '#') {
        let wallCount = 0;

        // Tarkista ympäröivät ruudut (ylä-, ala-, vasen-, oikea-ruudut)
        const directions = [
          { dx: 0, dz: 1 },
          { dx: 0, dz: -1 },
          { dx: 1, dz: 0 },
          { dx: -1, dz: 0 },
        ];

        for (const direction of directions) {
          const nx = x + direction.dx;
          const nz = z + direction.dz;

          // Tarkista, että ympäröivässä ruudussa on seinä
          if (isWall(nx, nz)) {
            wallCount++;
          }
        }

        // Jos ympäröivissä ruuduissa on seinä vähintään 2:sta 4:stä, lisää koordinaatti openCoordinates-taulukkoon
        if (wallCount >= 2) {
          // NOTICE: Korjattu koordinaatit vastaamaan kyseisen ruudun keskikohtaa.
          openCoordinates.push(new THREE.Vector3(x + 0.5, 0, z + 0.5));
        }
      }
    }
  }

  return openCoordinates;
}

// Pelaajan sijainnin alustus: valitaan satunnainen paikka.
function initPlayer() {
  // Hae koordinaatit
  const coordinates = findOpenCoordinatesWithSurroundingWalls();

  // Valitse satunnainen lähtöpaikka
  const randomIndex = Math.floor(Math.random() * coordinates.length);
  const startPosition = coordinates[randomIndex];

  // Aseta lähtöpaikka muuttujiin
  target.position.copy(startPosition);
  // NOTICE: Korjattu korkeus.
  startPosition.y = eyeLevel;
  playerMoveTarget.copy(startPosition);
  player.position.copy(startPosition);

  // Valitse koordinaatti, joka on kauimpana pelaajasta
  let farthestDistance = 0;
  let farthestPosition = new THREE.Vector3();

  for (const position of coordinates) {
    const distance = player.position.distanceTo(position);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestPosition.copy(position);
    }
  }

  // Aseta kaukaisin koordinaatti muuttujiin
  targetNextPosition.copy(farthestPosition);
  playerLookTarget.copy(farthestPosition);
  playerLookTargetNow.copy(farthestPosition);
}

function relocateTarget() {
  const coordinates = findOpenCoordinatesWithSurroundingWalls();

  // Poista koordinaatit, jotka ovat pelaajan ja kohteen välissä tai liian lähellä pelaajaa
  const filteredCoordinates = coordinates.filter(position => {
    const distanceToPlayer = player.position.distanceTo(position);
    const distanceToTarget = target.position.distanceTo(position);

    if (distanceToPlayer < 5 || distanceToTarget < 5) {
      return false;
    }

    raycaster.set(player.position, position.clone().sub(player.position).normalize());
    const intersects = raycaster.intersectObjects(scene.children, true);

    // NOTICE: Vaihdettu tarkastus oikein päin, piti olla piilossa eikä esillä.
    // NOTICE: Lisätty tarkastus, jotta kamera ja kaukaiset kohteet jäävät pois.
    if (!intersects.some(i => i.object != camera && i.distance < distanceToPlayer - 0.1)) {
      return false;
    }

    return true;
  });

  if (filteredCoordinates.length > 0) {
    // Valitse satunnainen koordinaatti jäljelle jäävistä
    const randomIndex = Math.floor(Math.random() * filteredCoordinates.length);
    targetNextPosition.copy(filteredCoordinates[randomIndex]);
    playerLookTarget.lerp(targetNextPosition, 1.5 / mapW); // NOTICE: Lisätty katseen kääntö.
  }
}

function startGame() {
  // NOTICE: Lisätty kellon alustus.
  lastTime = performance.now();

  // NOTICE: Lisätty teksti showText-funktiolla. Poistettu laskuri.
  showText(0, 3, "Tule etsimään!");
}

// NOTICE: Lisätty export.
export { init };
