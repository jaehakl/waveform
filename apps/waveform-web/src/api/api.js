import axios from 'axios';

// === JTBD ===
export const fetchJtbdTree = () => axios.get('http://localhost:8000/jtbd-tree/');
export const fetchJtbdList = () => axios.get('http://localhost:8000/jtbd-list/');
export const fetchJtbd = (id) => axios.get(`http://localhost:8000/jtbd/${id}`);
export const updateJtbd = (data) => axios.patch('http://localhost:8000/update-jtbd/', data);
export const addJtbd = (parent_id, name) => axios.post('http://localhost:8000/add-jtbd/', { parent_id, name });
export const deleteJtbd = (id) => axios.delete(`http://localhost:8000/delete-jtbd/${id}`);

// === Actor ===
export const fetchActorTree = () => axios.get('http://localhost:8000/actor-tree/');
export const fetchActorList = () => axios.get('http://localhost:8000/actor-list/');
export const fetchActor = (id) => axios.get(`http://localhost:8000/actor/${id}`);
export const addActor = (data) => axios.post('http://localhost:8000/add-actor/', data);
export const updateActor = (data) => axios.patch('http://localhost:8000/update-actor/', data);
export const deleteActor = (id) => axios.delete(`http://localhost:8000/delete-actor/${id}`);

// === Tech ===
export const fetchTechTree = () => axios.get('http://localhost:8000/tech-tree/');
export const fetchTechList = () => axios.get('http://localhost:8000/tech-list/');
export const fetchTech = (id) => axios.get(`http://localhost:8000/tech/${id}`);
export const addTech = (data) => axios.post('http://localhost:8000/add-tech/', data);
export const updateTech = (data) => axios.patch('http://localhost:8000/update-tech/', data);
export const deleteTech = (id) => axios.delete(`http://localhost:8000/delete-tech/${id}`);
export const fetchTechListByActor = (actorId) => axios.get(`http://localhost:8000/actor/${actorId}/tech-list/`);

// === Component ===
export const fetchComponentList = (tech_id) => {if (tech_id) {return axios.get(`http://localhost:8000/component-list/${tech_id}`);} else {return { data: [] };}};
export const fetchComponent = (id) => axios.get(`http://localhost:8000/component/${id}`);
export const addComponent = (data) => axios.post('http://localhost:8000/add-component/', data);
export const updateComponent = (data) => axios.patch('http://localhost:8000/update-component/', data);
export const deleteComponent = (id) => axios.delete(`http://localhost:8000/delete-component/${id}`);

// === Product ===
export const fetchProductTree = () => axios.get('http://localhost:8000/product-tree/');
export const fetchProductList = () => axios.get('http://localhost:8000/product-list/');
export const fetchProduct = (id) => axios.get(`http://localhost:8000/product/${id}`);
export const addProduct = (data) => axios.post('http://localhost:8000/add-product/', data);
export const updateProduct = (data) => axios.patch('http://localhost:8000/update-product/', data);
export const deleteProduct = (id) => axios.delete(`http://localhost:8000/delete-product/${id}`);

// === Discussion ===
export const fetchDiscussionTree = () => axios.get('http://localhost:8000/discussion-tree/');
export const fetchDiscussionList = () => axios.get('http://localhost:8000/discussion-list/');
export const fetchDiscussion = (id) => axios.get(`http://localhost:8000/discussion/${id}`);
export const addDiscussion = (data) => axios.post('http://localhost:8000/add-discussion/', data);
export const updateDiscussion = (data) => axios.patch('http://localhost:8000/update-discussion/', data);
export const deleteDiscussion = (id) => axios.delete(`http://localhost:8000/delete-discussion/${id}`);
