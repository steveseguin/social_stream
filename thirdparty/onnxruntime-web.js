// ONNX Runtime Web module wrapper
// This file exports the ort global as an ES module

const ort = window.ort;
export default ort;
export const InferenceSession = ort.InferenceSession;
export const Tensor = ort.Tensor; 
export const env = ort.env;