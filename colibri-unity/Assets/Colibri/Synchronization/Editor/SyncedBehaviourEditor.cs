using UnityEditor;
using UnityEngine;
using System;

namespace HCIKonstanz.Colibri.Synchronization
{
    [CustomEditor(typeof(SyncBehaviour<>), true)]
    public class SyncedBehaviourEditor : Editor
    {
        public override void OnInspectorGUI()
        {
            base.OnInspectorGUI();
            OnInspectorGUI((dynamic)target);
        }

        private void OnInspectorGUI<T>(SyncBehaviour<T> script)
            where T : SyncBehaviour<T>
        {
            if (script)
            {
                if (GUILayout.Button("Generate ID"))
                    script.Id = Guid.NewGuid().ToString();
            }
        }
    }
}
