import { assertPolymorphicType } from 'ember-data/-debug';
import Relationship from './relationship';
import OrderedSet from '../../ordered-set';
import { isNone } from '@ember/utils';

export default class ManyRelationship extends Relationship {
  constructor(store, inverseKey, relationshipMeta, modelData, inverseIsAsync) {
    super(store, inverseKey, relationshipMeta, modelData, inverseIsAsync);
    this.belongsToType = relationshipMeta.type;
    this.canonicalState = [];
    this.currentState = [];
  }

  removeInverseRelationships() {
    super.removeInverseRelationships();

    /* TODO Igor make sure this is still working
    if (this._loadingPromise) {
      this._loadingPromise.destroy();
    }
    */
  }

  addCanonicalModelData(modelData, idx) {
    if (this.canonicalMembers.has(modelData)) {
      return;
    }
    if (idx !== undefined) {
      this.canonicalState.splice(idx, 0, modelData);
    } else {
      this.canonicalState.push(modelData);
    }
    super.addCanonicalModelData(modelData, idx);
  }

  inverseDidDematerialize(inverseModelData) {
    super.inverseDidDematerialize(inverseModelData);
    if (this.isAsync) {
      this.notifyManyArrayIsStale();
    }
  }

  notifyManyArrayIsStale() {
    let storeWrapper = this.modelData.storeWrapper;
    let modelData = this.modelData;
    storeWrapper.notifyPropertyChange(modelData.modelName, modelData.id, modelData.clientId, this.key);
  }

  addModelData(modelData, idx) {
    if (this.members.has(modelData)) {
      return;
    }

    assertPolymorphicType(this.modelData, this.relationshipMeta, modelData, this.store);
    super.addModelData(modelData, idx);
    // make lazy later
    if (idx === undefined) {
      idx = this.currentState.length;
    }
    this.currentState.splice(idx, 0, modelData);
    // TODO Igor consider making direct to remove the indirection
    // We are not lazily accessing the manyArray here because the change is coming from app side
    // this.manyArray.flushCanonical(this.currentState);
    this.notifyHasManyChanged();
  }

  removeCanonicalModelDataFromOwn(modelData, idx) {
    let i = idx;
    if (!this.canonicalMembers.has(modelData)) {
      return;
    }
    if (i === undefined) {
      i = this.canonicalState.indexOf(modelData);
    }
    if (i > -1) {
      this.canonicalState.splice(i, 1);
    }
    super.removeCanonicalModelDataFromOwn(modelData, idx);
    //TODO(Igor) Figure out what to do here
  }

  removeAllCanonicalModelDatasFromOwn() {
    super.removeAllCanonicalModelDatasFromOwn();
    this.canonicalMembers.clear();
    this.canonicalState.splice(0, this.canonicalState.length);
  }

  //TODO(Igor) DO WE NEED THIS?
  removeCompletelyFromOwn(modelData) {
    super.removeCompletelyFromOwn(modelData);

    // SCEPTICAL
    const canonicalIndex = this.canonicalState.indexOf(modelData);

    if (canonicalIndex !== -1) {
      this.canonicalState.splice(canonicalIndex, 1);
    }

    this.removeModelDataFromOwn(modelData);
  }

  flushCanonical() {
    let toSet = this.canonicalState;

    //a hack for not removing new records
    //TODO remove once we have proper diffing
    let newModelDatas = this.currentState.filter(
      // only add new internalModels which are not yet in the canonical state of this
      // relationship (a new internalModel can be in the canonical state if it has
      // been 'acknowleged' to be in the relationship via a store.push)

      //TODO Igor deal with this
      (modelData) => modelData.isNew() && toSet.indexOf(modelData) === -1
    );
    toSet = toSet.concat(newModelDatas);

    /*
    if (this._manyArray) {
      this._manyArray.flushCanonical(toSet);
    }
    */
    this.currentState = toSet;
    super.flushCanonical();
    // Once we clean up all the flushing, we will be left with at least the notifying part
    this.notifyHasManyChanged();
  }

  //TODO(Igor) idx not used currently, fix
  removeModelDataFromOwn(modelData, idx) {
    super.removeModelDataFromOwn(modelData, idx);
    let index = idx || this.currentState.indexOf(modelData);

    //TODO IGOR DAVID INVESTIGATE
    if (index === -1) {
      return;
    }
    this.currentState.splice(index, 1);
    // TODO Igor consider making direct to remove the indirection
    // We are not lazily accessing the manyArray here because the change is coming from app side
    this.notifyHasManyChanged();
   // this.manyArray.flushCanonical(this.currentState);
  }

  notifyRecordRelationshipAdded() {
    this.notifyHasManyChanged();
  }

  computeChanges(modelDatas = []) {
    let members = this.canonicalMembers;
    let modelDatasToRemove = [];
    let modelDatasSet = setForArray(modelDatas);

    members.forEach(member => {
      if (modelDatasSet.has(member)) { return; }

      modelDatasToRemove.push(member);
    });

    this.removeCanonicalModelDatas(modelDatasToRemove);

    for (let i = 0, l = modelDatas.length; i < l; i++) {
      let modelData = modelDatas[i];
      this.removeCanonicalModelData(modelData);
      this.addCanonicalModelData(modelData, i);
    }
  }

  setInitialModelDatas(modelDatas) {
    if (Array.isArray(modelDatas) === false || modelDatas.length === 0) {
      return;
    }

    for (let i = 0; i< modelDatas.length; i++) {
      let modelData = modelDatas[i];
      if (this.canonicalMembers.has(modelData)) {
        continue;
      }

      this.canonicalMembers.add(modelData);
      this.members.add(modelData);
      this.setupInverseRelationship(modelData);
    }

    this.canonicalState = this.canonicalMembers.toArray();
  }

  notifyHasManyChanged() {
    let modelData = this.modelData;
    let storeWrapper = this.modelData.storeWrapper;
    storeWrapper.notifyHasManyChange(modelData.modelName, modelData.id, modelData.clientId, this.key);
  }

<<<<<<< HEAD
  getRecords() {
    //TODO(Igor) sync server here, once our syncing is not stupid
    let manyArray = this.manyArray;

    if (this.isAsync) {
      let promise;

      if (this._shouldFindViaLink()) {
        promise = this.findLink().then(() => this.findRecords());
      } else {
        promise = this.findRecords();
      }

      return this._updateLoadingPromise(promise, manyArray);
    } else {
      assert(`You looked up the '${this.key}' relationship on a '${this.internalModel.type.modelName}' with id ${this.internalModel.id} but some of the associated records were not loaded. Either make sure they are all loaded together with the parent record, or specify that the relationship is async ('DS.hasMany({ async: true })')`, manyArray.isEvery('isEmpty', false));

      manyArray.set('isLoaded', true);

      return manyArray;
=======
  getData() {
    let payload = {};
    if (this.hasData) {
      payload.data = this.currentState.map((modelData) => modelData.getResourceIdentifier());
    }
    if (this.link) {
      payload.links = {
        related: this.link
      }
>>>>>>> rebase done up to unloading
    }
    if (this.meta) {
      // TODO Igor consider whether we should namespace this
      payload.meta = this.meta;
    }
    payload.hasLoaded = this.hasLoaded;
    return payload;
  }

  updateData(data, initial) {
    let modelDatas;
    if (isNone(data)) {
      modelDatas = undefined;
    } else {
<<<<<<< HEAD
      this.updateInternalModelsFromAdapter(internalModels);
    }
  }

  localStateIsEmpty() {
    let manyArray = this.manyArray;
    let internalModels = manyArray.currentState;
    let manyArrayIsLoaded = manyArray.get('isLoaded');

    if (!manyArrayIsLoaded && internalModels.length) {
      manyArrayIsLoaded = internalModels.reduce((hasNoEmptyModel, i) => {
        return hasNoEmptyModel && !i.isEmpty();
      }, true);
    }

    return !manyArrayIsLoaded;
  }

  destroy() {
    super.destroy();
    let manyArray = this._manyArray;
    if (manyArray) {
      manyArray.destroy();
      this._manyArray = null;
    }

    let proxy = this._loadingPromise;

    if (proxy) {
      proxy.destroy();
      this._loadingPromise = null;
=======
      modelDatas = new Array(data.length);
      for (let i = 0; i < data.length; i++) {
        modelDatas[i] = this.modelData.storeWrapper.modelDataFor(data[i].type, data[i].id);
      }
    }
    if (initial) {
      this.setInitialModelDatas(modelDatas);
    } else {
      this.updateModelDatasFromAdapter(modelDatas);
>>>>>>> rebase done up to unloading
    }
  }
}

function setForArray(array) {
  var set = new OrderedSet();

  if (array) {
    for (var i=0, l=array.length; i<l; i++) {
      set.add(array[i]);
    }
  }

  return set;
}
