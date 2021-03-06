import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { take } from 'rxjs/operators';

import * as THREE from 'three';
import { ISceneState, KEY_CODE } from 'client/app/share';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { SceneService } from '../scene.service';

const SCENE_PATH = '/assets/scenes/fantasy_book/scene.gltf';
const DRACO_LOADER_PATH = 'three/examples/jsm/libs/draco/gltf';
const BG_COLOR = '#fdfdf4';

@Component({
  selector: 'app-book',
  templateUrl: './book.component.html',
  styleUrls: ['./book.component.scss'],
})
export class BookSceneComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('canvas') private canvasRef: ElementRef;

  /* Listener key events */
  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (!this.camera) {
      return;
    }

    switch (event.key) {
      case KEY_CODE.RIGHT_ARROW:
        this.camera.position.x += 5;
        break;
      case KEY_CODE.LEFT_ARROW:
        this.camera.position.x -= 5;
        break;
      case KEY_CODE.UP_ARROW:
        this.camera.position.y += 5;
        break;
      case KEY_CODE.DOWN_ARROW:
        this.camera.position.y -= 5;
        break;
    }
  }

  /* update view on resize */
  @HostListener('window:resize', ['$event'])
  onResize() {
    if (!this.camera || !this.renderer) {
      return;
    }

    this.camera.aspect = this.aspectRatio;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeunloadHandler() {
    this.saveCurrentScene();
  }

  private get canvas(): HTMLCanvasElement {
    return this.canvasRef.nativeElement;
  }
  private get aspectRatio() {
    return this.canvas.clientWidth / this.canvas.clientHeight;
  }
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private loader = new GLTFLoader();
  private mixer: THREE.AnimationMixer;
  private clock = new THREE.Clock();
  private pmremGenerator: THREE.PMREMGenerator;
  private controls!: OrbitControls;
  private dracoLoader!: DRACOLoader;

  public loadingProgress: number | null = 1;
  public loadingState = true;
  private cameraState: string | null;

  constructor(private service: SceneService) {}

  ngOnInit() {
    this.service
      .getCameraState()
      .pipe(take(1))
      .subscribe(
        (state: ISceneState | null) => {
          this.cameraState = state?.cameraPosition || null;
        },
        (error) => {},
        () => {
          this.loadingState = false;
          this.camera ? this.setCameraState() : null;
        }
      );
  }

  ngAfterViewInit() {
    this.createRenderer();
    this.createScene();
    this.createControls();
    this.createLoader();
  }

  /* create scene */
  private createScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BG_COLOR);
    this.scene.environment = this.pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;

    this.camera = new THREE.PerspectiveCamera(100, this.aspectRatio, 1, 1000);
    this.setCameraState();
  }

  private setCameraState() {
    if (this.cameraState) {
      this.camera.matrix.fromArray(JSON.parse(this.cameraState));
      this.camera.matrix.decompose(
        this.camera.position,
        this.camera.quaternion,
        this.camera.scale
      );
    } else {
      this.camera.position.set(15, 30, 70);
    }
  }

  /* set params for renderer */
  private createRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
  }

  /* set loader params */
  private createLoader(): void {
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(DRACO_LOADER_PATH);

    this.loader.setDRACOLoader(this.dracoLoader);
    this.loader.load(
      SCENE_PATH,
      (gltf) => {
        const model = gltf.scene;
        model.position.set(1, 1, 10);
        model.scale.set(1, 1, 1);

        this.scene.add(model);

        this.mixer = new THREE.AnimationMixer(model);
        this.mixer.clipAction(gltf.animations[0]).play();
        this.animate();
        this.loadingProgress = null;
      },
      (xhr) => {
        this.loadingProgress = (xhr.loaded / xhr.total) * 100;
        this.loadingState ? (this.loadingProgress -= 5) : null; // wait load bar while loading state
      },
      (error) => console.log(error)
    );
  }

  /* set controls params */

  private createControls(): void {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 0.5, 0);
    this.controls.enablePan = true;
    this.controls.enableDamping = true;
    // this.controls.autoRotate = true;
    this.controls.listenToKeyEvents(this.canvas);
    this.controls.update();
  }

  /* set animate */
  private animate() {
    let component: BookSceneComponent = this;
    (function render() {
      requestAnimationFrame(render);
      const delta = component.clock.getDelta();
      component.mixer.update(delta);
      component.controls.update();
      component.renderer.render(component.scene, component.camera);
    })();
  }

  ngOnDestroy() {
    this.saveCurrentScene();
    this.renderer.dispose();
    this.controls.dispose();
    this.dracoLoader.dispose();
    this.pmremGenerator.dispose();
  }

  private saveCurrentScene() {
    /* save current position of camera */
    this.service
      .setCameraState(JSON.stringify(this.camera.matrix.toArray()))
      .pipe(take(1))
      .subscribe();
  }
}
