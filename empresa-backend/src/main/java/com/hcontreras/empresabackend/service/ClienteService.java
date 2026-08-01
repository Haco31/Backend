package com.hcontreras.empresabackend.service;

import com.hcontreras.empresabackend.entity.Cliente;
import com.hcontreras.empresabackend.repository.ClienteRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;

@Service
public class ClienteService {

    private final ClienteRepository clienteRepository;

    public ClienteService(ClienteRepository clienteRepository) {
        this.clienteRepository = clienteRepository;
    }

    public Page<Cliente> listar(int pagina, int tamano) {
        if (pagina < 0)
            pagina = 0;

        if (tamano <= 0)
            tamano = 10;

        Pageable pg = PageRequest.of(pagina, tamano);

        return clienteRepository.findAll(pg);
    }

    public Optional<Cliente> obtenerPorId(Long id) {
        return clienteRepository.findById(id);
    }

    public Cliente crear(Cliente cliente) {
        clienteRepository.findByEmail(cliente.getEmail()).ifPresent(c -> {
            throw new IllegalArgumentException("Ya existe un cliente con ese email");
        });
        return clienteRepository.save(cliente);
    }

    public Cliente actualizar(Long id, Cliente datos) {
        Cliente actual = clienteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Cliente no encontrado"));

        actual.setNombre(datos.getNombre());
        actual.setEmail(datos.getEmail());
        return clienteRepository.save(actual);
    }

    public void eliminar(long id) {
        if (!clienteRepository.existsById(id)) {
            throw new IllegalArgumentException("Cliente no encontrado");
        }
        clienteRepository.deleteById(id);
    }
}
