import { Image } from "expo-image";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";

import { CameraGuideOverlay } from "@/components/camera-guide-overlay";
import { colors } from "@/constants/app-theme";
import type { GuideType } from "@/constants/camera-guides";
import type { PhotoEditTransform, PhotoRatioLabel } from "@/types/photo";

type EditablePhotoCanvasProps = {
  uri: string | null;
  ratio: PhotoRatioLabel;
  originalAspectRatio?: number;
  initialTransform?: PhotoEditTransform | null;
  initialTransformKey?: number;
  guide: GuideType;
  guideVisible: boolean;
  guideSize: number;
  guideColor: string;
};

export type EditablePhotoCanvasHandle = {
  reset: () => void;
  rotateRight: () => void;
  fillFrame: () => void;
  getTransform: () => PhotoEditTransform;
};

const AnimatedImage = Animated.createAnimatedComponent(Image);

const ratioValue: Record<PhotoRatioLabel, number | null> = {
  Original: null,
  "1:1": 1,
  "3:4": 3 / 4,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "16:9": 16 / 9
};

export const EditablePhotoCanvas = forwardRef<
  EditablePhotoCanvasHandle,
  EditablePhotoCanvasProps
>(function EditablePhotoCanvas({
  uri,
  ratio,
  originalAspectRatio,
  initialTransform,
  initialTransformKey = 0,
  guide,
  guideVisible,
  guideSize,
  guideColor
}, ref) {
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  const reset = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = 1;
    rotation.value = 0;
  }, [rotation, scale, translateX, translateY]);

  const getCoverScale = useCallback(() => {
    if (!frameSize.width || !frameSize.height || !originalAspectRatio) {
      return 1;
    }

    const frameAspectRatio = frameSize.width / frameSize.height;
    const normalizedRotation = Math.abs(rotation.value % Math.PI);
    const isQuarterTurn = Math.abs(normalizedRotation - Math.PI / 2) < 0.01;
    const imageAspectRatio = isQuarterTurn
      ? 1 / originalAspectRatio
      : originalAspectRatio;

    if (imageAspectRatio > frameAspectRatio) {
      return imageAspectRatio / frameAspectRatio;
    }

    return frameAspectRatio / imageAspectRatio;
  }, [frameSize.height, frameSize.width, originalAspectRatio, rotation]);

  const fillFrame = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    scale.value = Math.max(1, getCoverScale());
  }, [getCoverScale, scale, translateX, translateY]);

  const applyTransform = useCallback(
    (transform: PhotoEditTransform) => {
      translateX.value = transform.translateX;
      translateY.value = transform.translateY;
      scale.value = transform.scale;
      rotation.value = transform.rotation;
    },
    [rotation, scale, translateX, translateY]
  );

  useEffect(() => {
    reset();
  }, [ratio, reset, uri]);

  useEffect(() => {
    if (initialTransform && uri) {
      applyTransform(initialTransform);
    }
  }, [applyTransform, initialTransform, initialTransformKey, uri]);

  useImperativeHandle(ref, () => ({
    reset,
    rotateRight: () => {
      rotation.value += Math.PI / 2;
    },
    fillFrame,
    getTransform: () => ({
      ratioLabel: ratio,
      translateX: Number(translateX.value.toFixed(2)),
      translateY: Number(translateY.value.toFixed(2)),
      scale: Number(scale.value.toFixed(3)),
      rotation: Number(rotation.value.toFixed(4)),
      frameWidth: frameSize.width,
      frameHeight: frameSize.height
    })
  }));

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.35, Math.min(5, startScale.value * event.scale));
    });

  const rotate = Gesture.Rotation()
    .onStart(() => {
      startRotation.value = rotation.value;
    })
    .onUpdate((event) => {
      rotation.value = startRotation.value + event.rotation;
    });

  const composedGesture = Gesture.Simultaneous(pan, pinch, rotate);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` }
    ]
  }));

  return (
    <View style={styles.stage}>
      <View
        style={[
          styles.frame,
          {
            aspectRatio:
              ratio === "Original"
                ? originalAspectRatio ?? 4 / 5
                : ratioValue[ratio] ?? 4 / 5
          }
        ]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setFrameSize({
            width: Number(width.toFixed(2)),
            height: Number(height.toFixed(2))
          });
        }}
      >
        {uri ? (
          <GestureDetector gesture={composedGesture}>
            <AnimatedImage
              source={{ uri }}
              style={[styles.image, imageStyle]}
              contentFit="contain"
            />
          </GestureDetector>
        ) : (
          <View style={styles.emptyFrame} />
        )}

        <CameraGuideOverlay
          guide={guide}
          visible={guideVisible}
          size={guideSize}
          color={guideColor}
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    backgroundColor: colors.ink
  },
  frame: {
    width: "100%",
    maxHeight: "100%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.32)",
    backgroundColor: colors.text
  },
  image: {
    width: "100%",
    height: "100%"
  },
  emptyFrame: {
    flex: 1,
    backgroundColor: colors.text
  }
});
