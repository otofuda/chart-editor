<template>
  <div
    :style="{
      bottom: `${measure.measurePositionBottom}px`,
      height: `${measure.measureHeight}px`
    }"
    class="measure"
    :class="{
      hiddenControl: notes.find(note => note.type === 95 && note.position === 0)
    }"
  >
    {{ measure.measure }}
    <Note
      v-for="(note, i) in notes.filter(n => n.type !== 2)"
      :key="i"
      :note="note"
      :measure="measure"
    />
  </div>
</template>

<script>
import Note from "./Note.vue";

export default {
  props: {
    notes: {
      type: Array,
      default: () => []
    },
    measure: {
      type: Object,
      required: true
    },
    measureData: {
      type: Array,
      default: () => []
    }
  },
  components: {
    Note
  }
};
</script>

<style lang="scss" scoped>
.measure {
  width: 300px;
  background: linear-gradient(
    to left,
    #303030 19.75%,
    #606060 20%,
    #303030 20.25%,
    #303030 39.75%,
    #606060 40%,
    #303030 40.25%,
    #303030 59.75%,
    #606060 60%,
    #303030 60.25%,
    #303030 79.75%,
    #606060 80%,
    #303030 80.75%
  );
  color: #ffffff;
  position: absolute;
  right: 40px;
  &:not(.hiddenControl) {
    box-shadow: inset 0 -1px 0 0 #606060;
  }
}
</style>
