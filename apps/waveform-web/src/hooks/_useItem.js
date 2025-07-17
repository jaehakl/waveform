import { useState, useEffect } from 'react';
import { 
  fetchActor, updateActor,
  fetchComponent, updateComponent,
  fetchProduct, updateProduct,
  fetchJtbd, updateJtbd,
  fetchTech, updateTech,
  fetchDiscussion, updateDiscussion
} from '../api/api';

// 공통 단일 항목 훅
function useItem(fetchFn, updateFn, id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchFn(id)
      .then(res => setData(res.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id, fetchFn]);

  const save = async (updateData) => {
    setLoading(true);
    try {
      await updateFn(updateData);
      await fetchFn(id).then(res => setData(res.data));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, save };
}

// Actor 훅
export function useActor(actorId) {
  return useItem(fetchActor, updateActor, actorId);
}

// Component 훅
export function useComponent(componentId) {
  return useItem(fetchComponent, updateComponent, componentId);
}

// Product 훅
export function useProduct(id) {
  return useItem(fetchProduct, updateProduct, id);
}

// JTBD 훅
export function useJtbd(jtbdId) {
  return useItem(fetchJtbd, updateJtbd, jtbdId);
}

// Tech 훅
export function useTech(techId) {
  return useItem(fetchTech, updateTech, techId);
} 



// Discussion 훅
export function useDiscussion(discussionId) {
  return useItem(fetchDiscussion, updateDiscussion, discussionId);
}

