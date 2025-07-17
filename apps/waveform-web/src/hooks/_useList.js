import { useState, useEffect } from 'react';
import { 
  fetchActorList, 
  fetchComponentList, 
  fetchProductList, 
  fetchTechTree,
  fetchTechList, 
  fetchJtbdTree,
  fetchJtbdList,
  fetchTechListByActor,
  fetchDiscussionList,
  fetchDiscussion,
  fetchActorTree,
  fetchProductTree,
  fetchDiscussionTree
} from '../api/api';

// 공통 리스트 훅
function useList(fetchFn, dependencies = []) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = () => {
    setLoading(true);
    fetchFn()
      .then(res => setList(res.data))
      .catch(setError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (dependencies.every(dep => dep !== undefined)) {
      reload();
    }
  }, dependencies);

  return { list, loading, error, reload };
}

// Actor 리스트 훅
export function useActorTree() {
  return useList(fetchActorTree);
}

export function useActorList() {
  return useList(fetchActorList);
}

// Component 리스트 훅
export function useComponentList(techId) {
  return useList(() => {
    if (techId) {
      return fetchComponentList(techId);
    } else {
      return Promise.resolve({ data: [] });
    }
  }, [techId]);
}

// Product Tree 훅
export function useProductTree() {
  return useList(fetchProductTree);
}

// Product 리스트 훅
export function useProductList() {
  return useList(fetchProductList);
}

// Tech Tree 훅
export function useTechTree() {
  return useList(fetchTechTree);
}

// Tech 리스트 훅
export function useTechList() {
  return useList(fetchTechList);
}

// JTBD Tree 훅
export function useJtbdTree() {
  return useList(fetchJtbdTree);
} 

// JTBD 리스트 훅
export function useJtbdList() {
  return useList(fetchJtbdList);
}

// Tech 리스트 by Actor 훅
export function useTechListByActor(actorId) {
  return useList(() => fetchTechListByActor(actorId), [actorId]);
} 

// Discussion Tree 훅
export function useDiscussionTree() {
  return useList(fetchDiscussionTree);
}

// Discussion 리스트 훅
export function useDiscussionList() {
  return useList(fetchDiscussionList);
}



