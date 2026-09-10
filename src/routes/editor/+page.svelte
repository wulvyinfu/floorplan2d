<script lang="ts">
  import { onMount } from 'svelte';
  import FloorplanEditor from '$lib/components/editor/FloorplanEditor.svelte';
  import { createDefaultProject } from '$lib/stores/project';
  import { localStore } from '$lib/services/datastore';
  import type { Project } from '$lib/models/types';

  let project: Project | undefined = $state();

  onMount(() => {
    (async () => {
      const url = new URL(window.location.href);
      const id = url.searchParams.get('id');
      const loaded = id ? await localStore.load(id) : null;
      project = loaded ?? createDefaultProject();
      if (!loaded) {
        await localStore.save(project);
        history.replaceState(null, '', `/editor?id=${project.id}`);
      }
    })();
  });
</script>

{#if project}
  <FloorplanEditor {project} dataStore={localStore} />
{:else}
  <div class="h-screen flex items-center justify-center">
    <p class="text-gray-400">Loading...</p>
  </div>
{/if}
