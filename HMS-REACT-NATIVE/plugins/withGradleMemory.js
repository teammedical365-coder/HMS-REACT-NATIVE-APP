const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Expo Config Plugin to configure Gradle JVM memory, Metaspace, and worker concurrency.
 * Ensures persistent configuration across `expo prebuild --clean` regenerations.
 *
 * Settings applied:
 * - org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
 * - org.gradle.workers.max=2
 * - org.gradle.parallel=false
 */
function withGradleMemory(config) {
  return withGradleProperties(config, (modConfig) => {
    const jvmArgs =
      '-Xmx2048m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

    const setProperty = (key, value) => {
      const existing = modConfig.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing) {
        existing.value = value;
      } else {
        modConfig.modResults.push({
          type: 'property',
          key,
          value,
        });
      }
    };

    setProperty('org.gradle.jvmargs', jvmArgs);
    setProperty('org.gradle.workers.max', '2');
    setProperty('org.gradle.parallel', 'false');

    return modConfig;
  });
}

module.exports = withGradleMemory;
