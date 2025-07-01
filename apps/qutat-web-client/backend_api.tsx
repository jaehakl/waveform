
export function public_setup_list(){return "/qutat/public/setup/list/"}
//pages\setup\share.tsx

export function public_setup_data(setup_id: String){return "/qutat/public/setup/data/"+setup_id+"/"}
export function public_setup_evaluate(){return "/qutat/public/setup/evaluate/"}
export function public_process_search_by_setup(setup_id: String){return "/qutat/public/process2/search/setup/"+setup_id+"/"}


export function setup_data(setup_id: String){return "/qutat/setup/data/"+setup_id+"/"}
//pages\setup\data\[setup_id].tsx
//pages\setup\shared-data\[setup_id].tsx

export function input_generate(setup_id: String, num_input: String){return "/qutat/input/generate/"+setup_id+"/"+num_input+"/"}
//pages\setup\data\[setup_id].tsx

export function model_setup(variable: String){return "/qutat/model/setup/"+variable+"/"}
//pages\setup\data\[setup_id].tsx
//pages\home.tsx

export function model_input(variable: String){return "/qutat/model/input/"+variable+"/"}
//pages\output\data\[input_id].tsx


export function find_input(variable: String, setup_id: String){return "/qutat/find/input/"+variable+"/"+setup_id+"/"}
export function results(setup_id: String){return "/qutat/results/"+setup_id+"/"}
//pages\setup\data\[setup_id].tsx

export function results_wo_output(setup_id: String){return "/qutat/results_wo_output/"+setup_id+"/"}
export function setup_tasks(setup_id: String){return "/qutat/setup/tasks/"+setup_id+"/"}
//pages\setup\data\[setup_id].tsx

export function output2_files(input_id: String){return "/qutat/output2/files/"+input_id+"/"}
export function results_files(input_id: String){return "/qutat/results/files/"+input_id+"/"}

export function entity_data(input_id: String){return "/qutat/entity/data/"+input_id+"/"}
//pages\output\data\[input_id].tsx

export function process_request_task2(){return "/qutat/process/request-task2/"}
export function model_process2(variable: String){return "/qutat/model/process2/"+variable+"/"}
export function process2_return(process_id: String){return "/qutat/process2/return/"+process_id+"/"}

export function image_upload(){return "/qutat/image/upload/"}
//pages\output\data\[input_id].tsx
//pages\setup\data\[setup_id].tsx

export function registration(){return "/users/registration/"}
export function token_new(){return "/users/token/new/"}

export function token_view(variable: String){return "/users/token/view/"+variable+"/"}
//pages\account.tsx

export function token_check(){return "/users/token/check/"}

export function users_login(){return "/users/login/"}
//core\network\auth\auth.tsx

export function users_logout(){return "/users/logout/"}
//core\network\auth\auth.tsx

export function users_user(){return "/users/user/"}
//core\network\auth\auth.tsx