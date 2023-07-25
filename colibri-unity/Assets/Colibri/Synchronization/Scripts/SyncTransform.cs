﻿using UnityEngine;
using UniRx;
using Newtonsoft.Json.Linq;
using System.Linq;
using System;

namespace HCIKonstanz.Colibri.Synchronization
{
    public class SyncTransform : MonoBehaviour
    {
        public const string CHANNEL = "synctransform";

        public string Id = null;

        public bool SyncPosition = true;
        public bool SyncRotation = true;
        public bool SyncScale = true;

        public bool AutoInitialize = false;
        public bool AutoGenerateId = false;

        private bool _hasReceivedFirstUpdate;

        private bool _hasReceivedPositionUpdate;
        private bool _hasReceivedRotationUpdate;
        private bool _hasReceivedScaleUpdate;
        private bool _hasReceivedDestroyCommand;

        private readonly ReactiveProperty<bool> _initializedSubject = new ReactiveProperty<bool>(false);

        private static readonly Subject<SyncTransform> _modelCreateSubject = new Subject<SyncTransform>();
        public static IObservable<SyncTransform> ModelCreated() => _modelCreateSubject.AsObservable();

        private static readonly Subject<SyncTransform> _modelDestroySubject = new Subject<SyncTransform>();
        public static IObservable<SyncTransform> ModelDestroyed() => _modelDestroySubject.AsObservable();


        private async void Awake()
        {
            if (AutoGenerateId)
                Id = Guid.NewGuid().ToString();
            if (AutoInitialize)
                Initialize();
            await _initializedSubject.Where(v => v).Take(1);

            // check if this object is still alive
            if (gameObject)
                _modelCreateSubject.OnNext(this);
        }

        private async void OnEnable()
        {
            await _initializedSubject.Where(v => v).Take(1);

            // check if this object is still alive
            if (!gameObject)
                return;

            Sync.AddModelDeleteListener(CHANNEL, OnModelDelete);

            Sync.AddModelUpdateListener(CHANNEL, OnPositionUpdate, Id);
            this.ObserveEveryValueChanged(_ => transform.localPosition)
                .TakeUntilDisable(this)
                .Where(_ => _hasReceivedFirstUpdate && SyncPosition)
                .Subscribe(val =>
                {
                    if (_hasReceivedPositionUpdate)
                        _hasReceivedPositionUpdate = false;
                    else
                        TriggerSync();
                });


            Sync.AddModelUpdateListener(CHANNEL, OnRotationUpdate, Id);
            this.ObserveEveryValueChanged(_ => transform.localRotation)
                .TakeUntilDisable(this)
                .Where(_ => _hasReceivedFirstUpdate && SyncRotation)
                .Subscribe(val =>
                {
                    if (_hasReceivedRotationUpdate)
                        _hasReceivedRotationUpdate = false;
                    else
                        TriggerSync();
                });


            Sync.AddModelUpdateListener(CHANNEL, OnScaleUpdate, Id);
            this.ObserveEveryValueChanged(_ => transform.localScale)
                .TakeUntilDisable(this)
                .Where(_ => _hasReceivedFirstUpdate && SyncScale)
                .Subscribe(val =>
                {
                    if (_hasReceivedScaleUpdate)
                        _hasReceivedScaleUpdate = false;
                    else
                        TriggerSync();
                });
        }

        private void OnDisable()
        {
            Sync.RemoveModelUpdateListener(CHANNEL, OnPositionUpdate);
            Sync.RemoveModelUpdateListener(CHANNEL, OnRotationUpdate);
            Sync.RemoveModelUpdateListener(CHANNEL, OnScaleUpdate);
            Sync.RemoveModelDeleteListener(CHANNEL, OnModelDelete);
        }

        private void OnModelDelete(JObject data)
        {
            var id = data["id"].Value<string>();
            if (id == Id)
            {
                _hasReceivedDestroyCommand = true;
                Destroy(gameObject, 0.001f);
            }
        }

        private bool _isQuitting;
        private void OnApplicationQuit()
        {
            _isQuitting = true;
        }

        private void OnDestroy()
        {
            _modelDestroySubject.OnNext(this);
            if (_isQuitting || _hasReceivedDestroyCommand)
                return;

            Sync.SendModelDelete(CHANNEL, Id.ToString());
        }


        private void OnPositionUpdate(JToken data)
        {
            if (SyncPosition)
            {
                var id = data["id"].Value<string>();
                _hasReceivedFirstUpdate |= id == Id;
                if (id == Id && data["Position"] != null)
                {
                    var pos = data["Position"].Select(v => (float)v).ToArray();
                    _hasReceivedPositionUpdate = true;
                    transform.localPosition = new Vector3(pos[0], pos[1], pos[2]);
                }
            }
        }

        private void OnRotationUpdate(JToken data)
        {
            if (SyncRotation)
            {
                var id = data["id"].Value<string>();
                _hasReceivedFirstUpdate |= id == Id;
                if (id == Id && data["Rotation"] != null)
                {
                    var rot = data["Rotation"].Select(v => (float)v).ToArray();
                    _hasReceivedRotationUpdate = true;
                    transform.localRotation = new Quaternion(rot[0], rot[1], rot[2], rot[3]);
                }
            }
        }

        private void OnScaleUpdate(JToken data)
        {
            if (SyncScale)
            {
                var id = data["id"].Value<string>();
                _hasReceivedFirstUpdate |= id == Id;
                if (id == Id && data["Scale"] != null)
                {
                    var scale = data["Scale"].Select(v => (float)v).ToArray();
                    _hasReceivedScaleUpdate = true;
                    transform.localScale = new Vector3(scale[0], scale[1], scale[2]);
                }
            }
        }

        public void Initialize()
        {
            if (_initializedSubject.Value)
                Debug.LogError("Cannot initialize synctransform twice! Please call Initialize only once or set AutoInitialze to false!");
            else
                _initializedSubject.Value = true;
        }


        public void TriggerSync()
        {
            var update = new JObject { { "id", Id }, };
            var t = transform;
            if (SyncPosition)
                update.Add("Position", new JArray { t.localPosition.x, t.localPosition.y, t.localPosition.z });
            if (SyncRotation)
                update.Add("Rotation", new JArray { t.localRotation.x, t.localRotation.y, t.localRotation.z, t.localRotation.w });
            if (SyncScale)
                update.Add("Scale", new JArray { t.localScale.x, t.localScale.y, t.localScale.z });

            Sync.SendModelUpdate(CHANNEL, update);
        }
    }
}
