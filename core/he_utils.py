try:
    import tenseal as ts
    TENSEAL_AVAILABLE = True
except ImportError:
    ts = None
    TENSEAL_AVAILABLE = False

import torch

def setup_tenseal_context():
    """
    Creates a TenSEAL context for CKKS schema if available, else returns mock context.
    """
    if TENSEAL_AVAILABLE:
        context = ts.context(ts.SCHEME_TYPE.CKKS, poly_modulus_degree=8192, coeff_mod_bit_sizes=[60, 40, 40, 60])
        context.generate_galois_keys()
        context.global_scale = 2**40
        return context
    return "MOCK_HE_CONTEXT"

def serialize_context(context):
    if TENSEAL_AVAILABLE and hasattr(context, "serialize"):
        return context.serialize()
    return b"MOCK_HE_CONTEXT_BYTES"

def encode_and_encrypt(context, tensor):
    """
    Flattens a PyTorch tensor, encodes and encrypts it using TenSEAL CKKS if available.
    """
    if not TENSEAL_AVAILABLE:
        return [f"ENC_MOCK_{tensor.shape}_{list(tensor.flatten()[:3].numpy())}"]
        
    data = tensor.flatten().tolist()
    chunk_size = 4096
    encrypted_chunks = []
    for i in range(0, len(data), chunk_size):
        chunk = data[i:i+chunk_size]
        enc_vector = ts.ckks_vector(context, chunk)
        encrypted_chunks.append(enc_vector.serialize())
    return encrypted_chunks

def aggregate_encrypted_chunks(chunks_list_of_lists, server_context_bytes):
    """
    Takes a list of encrypted update chunks from multiple clients.
    Aggregates (adds) them homomorphically.
    """
    context = ts.context_from(server_context_bytes)
    
    num_clients = len(chunks_list_of_lists)
    num_chunks = len(chunks_list_of_lists[0])
    
    aggregated_chunks = []
    
    for c_idx in range(num_chunks):
        # Start with the first client's encrypted chunk
        agg_val = ts.ckks_vector_from(context, chunks_list_of_lists[0][c_idx])
        
        # Homomorphically add the rest
        for client_idx in range(1, num_clients):
            agg_val += ts.ckks_vector_from(context, chunks_list_of_lists[client_idx][c_idx])
            
        # Homomorphically multiply by 1/N for Federated Averaging
        agg_val *= (1.0 / num_clients)
        
        aggregated_chunks.append(agg_val.serialize())
        
    return aggregated_chunks

def decrypt_and_decode(context, encrypted_chunks, original_shape):
    """
    Decrypts the averaged encrypted chunks back to a PyTorch tensor.
    """
    data = []
    for enc_bytes in encrypted_chunks:
        enc_vec = ts.ckks_vector_from(context, enc_bytes)
        data.extend(enc_vec.decrypt())
        
    # Reconstruct shape
    tensor = torch.tensor(data[:torch.prod(torch.tensor(original_shape))]).reshape(original_shape)
    return tensor
