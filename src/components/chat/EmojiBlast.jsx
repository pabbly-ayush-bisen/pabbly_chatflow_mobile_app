import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PARTICLE_COUNT = 22;
const DURATION = 2200;
const TOTAL_DURATION = DURATION + 400;

const EmojiBlast = ({ emoji, onComplete }) => {
  const [activeEmoji, setActiveEmoji] = useState(null);
  const particles = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!emoji) return;

    const newParticles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const heightRatio = Math.pow(Math.random(), 0.6);
      const riseHeight = SCREEN_HEIGHT * (0.15 + heightRatio * 0.8);

      const spreadFactor = 0.5 + heightRatio * 0.8;
      const endX = (Math.random() - 0.5) * SCREEN_WIDTH * spreadFactor * 1.3;

      const size = 18 + heightRatio * 22;
      const rotateEnd = (Math.random() - 0.5) * 50;
      const delay = (1 - heightRatio) * 40 + Math.random() * 80;

      newParticles.push({
        progress: new Animated.Value(0),
        endX,
        riseHeight,
        size,
        rotateEnd,
        delay,
      });
    }
    particles.current = newParticles;
    setActiveEmoji(emoji);

    const anims = newParticles.map((p) =>
      Animated.timing(p.progress, {
        toValue: 1,
        duration: DURATION,
        delay: p.delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    );

    Animated.parallel(anims).start();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveEmoji(null);
      particles.current = [];
      onComplete?.();
    }, TOTAL_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [emoji]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeEmoji || particles.current.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {particles.current.map((p, index) => {
        const translateX = p.progress.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, p.endX * 0.6, p.endX],
        });
        const translateY = p.progress.interpolate({
          inputRange: [0, 0.5, 0.8, 1],
          outputRange: [0, -p.riseHeight * 0.9, -p.riseHeight, -p.riseHeight + 20],
        });
        const scale = p.progress.interpolate({
          inputRange: [0, 0.1, 0.35, 0.8, 1],
          outputRange: [0.2, 1, 1, 0.8, 0],
        });
        const opacity = p.progress.interpolate({
          inputRange: [0, 0.08, 0.6, 0.85, 1],
          outputRange: [0, 1, 1, 0.3, 0],
        });
        const rotate = p.progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${p.rotateEnd}deg`],
        });

        return (
          <Animated.Text
            key={`${index}-${activeEmoji}`}
            style={[
              styles.particle,
              {
                fontSize: p.size,
                opacity,
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                  { rotate },
                ],
              },
            ]}
          >
            {activeEmoji}
          </Animated.Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  particle: {
    position: 'absolute',
    bottom: 0,
  },
});

export default EmojiBlast;
